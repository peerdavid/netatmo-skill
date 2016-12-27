/**
 *  Netatmo weather station skill for amazon Alexa
 * 
 * Author: Peer David
 * Date: 23.12.2016
 * 
 * Note: To download names of companies by industry:
 */

/**
 * App ID for the skill
 */
var APP_ID = null; //"amzn1.ask.skill.f3acff9f-f593-4793-9682-27b789533f6f";

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');
var http = require('http');

/**
 * To read more about inheritance in JavaScript, see the link below.
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var Netatmo = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
Netatmo.prototype = Object.create(AlexaSkill.prototype);
Netatmo.prototype.constructor = Netatmo;


Netatmo.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("Netatmo onSessionStarted requestId: " + sessionStartedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any initialization logic goes here
};


Netatmo.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("Netatmo onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    askForModule(response);
};


Netatmo.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("Netatmo onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};


Netatmo.prototype.intentHandlers = {
    "ALL": function (intent, session, response) {
        response.tell("Sorry, bin gerade am programmiern... Liebe Grüße David");
    },

    "Temperature": function (intent, session, response) {
        response.tell("Sorry, bin gerade am programmiern... Liebe Grüße David");
    },

    "Humidity": function (intent, session, response) {
        response.tell("Sorry, bin gerade am programmiern... Liebe Grüße David");
    },

    "COZWEI": function (intent, session, response) {
        response.tell("Sorry, bin gerade am programmiern... Liebe Grüße David");
    },

    "Noise": function (intent, session, response) {
        response.tell("Sorry, bin gerade am programmiern... Liebe Grüße David");
    },

    "Pressure": function (intent, session, response) {
        response.tell("Sorry, bin gerade am programmiern... Liebe Grüße David");
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        askForModule(response);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        response.tell("Servus und bis zum nächsten mal.");
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        response.tell("Servus und bis zum nächsten mal.");
    }
};


function askForModule(response){
    var speechOutput = "Mit Wetterstation kannst du deine privaten Wetter daten abfragen. Welches Modul soll ich abfragen?";
    var reprompText = "Welches Modul soll ich abfragen?";
    response.ask(speechOutput, reprompText);
}


/**
 * Create the handler that responds to the Alexa Request.
 */
exports.handler = function (event, context) {
    var netatmo = new Netatmo();
    netatmo.execute(event, context);
};