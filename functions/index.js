const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

//function that checks for appointments 
//that are needed to be reminded to the customer:
exports.dailyCheck = functions.pubsub
    .schedule('0 20 * * *')
    .timeZone('Israel')
    .onRun(async (context) => {
        //getting today's date
        let today = new Date(Date.now());
        let day = today.getUTCDate();
        let month = today.getUTCMonth() + 1;
        if (month < 10) {
            month = "0" + month;
        } else {
            month = month.toString();
        }
        let year = today.getFullYear();
        let date_af = "" + (day + 1) + month + year;

        //getting the array of appointments:
        const snapshot = await admin.database().ref("AppointmentsDates").child(date_af).once('value');
        let keys = snapshot.val();

        for (var key in keys) {
            if (keys.hasOwnProperty(key)) {
                const appointment = await admin.database().ref('Appointments').child(key).once('value');

                let appoint = appointment.val();

                let barber = appoint.barber["name"];
                let service = appoint.servies["servies"];
                let time = appoint.units[0].startTime;
                let min = time["minutes"];
                let hours = time["hours"];
                time = hours + ":" + min;

                const tokenSnapshot = await admin.database()
                    .ref(`/NotificationsToken/${key}`).once('value');

                let token = tokenSnapshot.val()["token"];
                //date for notification:
                let appoint_date = "" + (day + 1) + '/' + month;

                const payload = {
                    notification: {
                        title: 'תזכורת לתור',
                        body: `רצינו להזכירך שיש לך תור מחר (${appoint_date}) בשעה ${time} ל${service} אצל ${barber} `,
                        icon: "https://i.imgur.com/Sdhxwwj.png"
                    }
                };
                let tokenToRemove;
                //Send to device:                                
                // For each message check if there was an error.

                const response = await admin.messaging().sendToDevice(token, payload);
                const error = response.results[0].error;
                if (error) {
                    console.error('Failure sending notification to', token, error);
                    // Cleanup the tokens who are not registered anymore.
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        const remove_response = await admin.database()
                            .ref(`/NotificationsToken/${key}`).remove();
                    }
                }
            }
        }
    });

exports.openScheduleCheck = functions.pubsub
    .schedule('0 * * * *')
    .timeZone('Israel')
    .onRun(async (context) => {
        const snapshot = await admin.database().ref("Notifications").once('value');
        const allDates = snapshot.val();
        for (let date in allDates) {
            if (allDates.hasOwnProperty(date)) {
                const barberSnap = await admin.database().ref(`Notifications/${date}`).once('value');
                const barbers_ar = barbersSnap.val();
                let index = 0;
                for (let barber of barbers_ar) {
                    index++;
                    const dateSnapshot = await admin.database().ref(`Dates/${index}/availableDays/${date}`).once('value');
                    if (dateSnapshot.exists()) {
                        if (barber) {
                            let tokens = [];
                            let tokenForName;
                            for (const token in barber) {
                                if (barber.hasOwnProperty(token)) {
                                    tokens.push(token);
                                    tokenForName = token;
                                }
                            }
                            // Notification details:
                            const payload = {
                                notification: {
                                    title: 'Neighbors Barbershop',
                                    body: `נפתחנו תורים ל${barber[tokenForName]} לתאריך ${date}`,
                                    icon: "https://i.imgur.com/Sdhxwwj.png"
                                }
                            };
                            //Send to device:
                            // For each message check if there was an error.
                            let tokensToRemove = [];
                            const response = await admin.messaging().sendToDevice(tokens, payload);
                            response.results.forEach((result, index) => {
                                const error = result.error;
                                if (error) {
                                    console.error('Failure sending notification to', token + ' ' + error);
                                    // Cleanup the tokens who are not registered anymore.
                                    if (error.code === 'messaging/invalid-registration-token' ||
                                        error.code === 'messaging/registration-token-not-registered') {
                                        tokensToRemove.push(admin.database().ref(`/NotificationsToken/${token}`).remove());
                                    }
                                }
                            });
                            return Promise.all(tokensToRemove);
                        }
                    }
                }
            }
        }
    });




