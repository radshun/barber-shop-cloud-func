const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

//function that checks for appointments 
//that are needed to be reminded to the customer:
exports.dailyCheck = functions.pubsub
    .schedule('0 20 * * *')
    .timeZone('Israel')
    .onRun((context) => {
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
        admin.database().ref("AppointmentsDates").child(date_af).once('value')
            .then((snapshot) => {
                let keys = snapshot.val();
                for (var key in keys) {
                    if (keys.hasOwnProperty(key)) {
                        let appoint_ref = admin.database().ref('Appointments').child(key);

                        appoint_ref.once('value').then((appointment) => {
                            let appoint = appointment.val();

                            let barber = appoint.barber["name"];
                            let service = appoint.servies["servies"];
                            let time = appoint.units[0].startTime;
                            let min = time["minutes"];
                            let hours = time["hours"];
                            time = min + ":" + hours;

                            // Get the device notification token.
                            const deviceTokenPromise = admin.database()
                                .ref(`/NotificationsToken/${key}`).once('value');

                            // The array containing all the user's tokens.
                            let token;

                            Promise.all([deviceTokenPromise]).then((values) => {

                                token = values[0].val();
                                //Token:
                                token = token["token"];
                                // Notification details:
                                const payload = {
                                    notification: {
                                        title: 'Neighbors Barbershop',
                                        body: `רצינו להזכירך שיש לך מחר תור ל${service}לשעה ${time} אצל ${barber}`,
                                        icon: "https://i.imgur.com/Sdhxwwj.png"
                                    }
                                };
                                let tokenToRemove;
                                //Send to device:
                                // For each message check if there was an error.
                                admin.messaging().sendToDevice(token, payload)
                                    .then((result) => {
                                        console.log('result:', result);
                                    }
                                    ).catch((reason) => {
                                        if (reason) {
                                            console.error('Failure sending notification to', token + ' ' + reason);
                                            // Cleanup the tokens who are not registered anymore.
                                            if (error.code === 'messaging/invalid-registration-token' ||
                                                error.code === 'messaging/registration-token-not-registered') {
                                                tokenToRemove = admin.database().ref(`/NotificationsToken/${key}`).remove();
                                            }
                                        }
                                        return Promise.all([tokenToRemove]);
                                    });
                            });
                        });
                    }
                }
            }).then(() => {
                console.log('finished propertly');
            });

    });

//function that checks for notifications 
//that are needed to be sent to the users who asked for them:
exports.openScheduleCheck = functions.pubsub
    .schedule('0 * * * *')
    .timeZone('Israel')
    .onRun((context) => {
        admin.database().ref("Notifications").once('value')
            .then((snapshot) => {
                const allDates = snapshot.val();
                for (let date in allDates) {
                    if (allDates.hasOwnProperty(date)) {
                        admin.database().ref(`Notifications/${date}`).once('value').then((barbersSnap) => {
                            const barbers_ar = barbersSnap.val();
                            let index = 0;
                            for (let barber of barbers_ar) {
                                index++;
                                let dateRef = admin.database().ref(`Dates/${index}/availableDays/${date}`);
                                dateRef.once('value').then((dateSnapshot) => {
                                    if (dateSnapshot.exists()) {
                                        if (barber) {
                                            let tokens = [];
                                            let tokenForName;
                                            for (const token in barber) {
                                                if (barber.hasOwnProperty(key)) {
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
                                            admin.messaging().sendToDevice(token, payload)
                                                .then((result) => {
                                                    console.log('result:', result);
                                                }
                                                ).catch((reason) => {
                                                    if (reason) {
                                                        console.error('Failure sending notification to', token + ' ' + reason);
                                                        // Cleanup the tokens who are not registered anymore.
                                                        if (error.code === 'messaging/invalid-registration-token' ||
                                                            error.code === 'messaging/registration-token-not-registered') {
                                                            tokensToRemove.push(admin.database().ref(`/NotificationsToken/${key}`).remove());
                                                        }
                                                    }
                                                    return Promise.all([tokensToRemove]);
                                                });
                                        }
                                    }
                                });
                            }
                        });
                    }
                }
            });
    });