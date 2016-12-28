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
var https = require('https');
var querystring = require('querystring');


/*
 * ERROR CODES
 */
var ERR_READ_DATA = "Beim auslesen der Daten ist ein Fehler aufgetreten.";


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
    this.askForModule(session, response);
};


Netatmo.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("Netatmo onSessionEnded requestId: " + sessionEndedRequest.requestId
        + ", sessionId: " + session.sessionId);
    // any cleanup logic goes here
};



Netatmo.prototype.intentHandlers = {    
    "Module": function (intent, session, response) {
        var self = this;

        self.getData(session, function(data){
            var locationName = getLocationNameFromIntentSlots(intent.slots);

            var module = self.readModule(locationName, data);
            if(!module){
                response.tell("Im " + locationName + " ist keine Wetterstation vorhanden.");
                return;
            }

            var speechOutput = "Die Wetterstation im " + locationName  + " hat die folgenden Sensoren: "+ module.supported_sensors.join(", ") +
                               ". Welcher Wert interessiert dich im " + locationName + "?";
            var reprompText = "Welcher Wert interessiert dich im " + locationName + "?";
            response.ask(speechOutput, reprompText);

        }, function(err){
            response.tell(ERR_READ_DATA);       
        });
    },

    "ALL": function (intent, session, response) {
        response.tell("Sorry, bin gerade am programmiern... Liebe Grüße David");
    },

    "Temperature": function (intent, session, response) {
        response.tell("Hoaße partie do herinnen...");
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
        this.askForModule(session, response);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        response.tell("Servus und bis zum nächsten mal.");
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        response.tell("Servus und bis zum nächsten mal.");
    }
};


Netatmo.prototype.askForModule = function(session, response){
    var self = this;
    self.getData(session, function(data){
        var locations = self.readLocationNames(data);
        var speechOutput = "Sie haben an den Orten " + locations.join(", ") + " eine Wetterstation. Von welchem Ort möchtest du Daten wissen?";
        var reprompText = "Von welchem Ort möchtest du Daten wissen?";
        response.ask(speechOutput, reprompText);

    }, function(err){
        var speechOutput = "Mit Wetterstation kannst du deine privaten Wetter daten abfragen. Von welchem Ort möchtest du Daten wissen?";
        var reprompText = "Von welchem Ort möchtest du Daten wissen?";
        response.ask(speechOutput, reprompText);
    });
}


Netatmo.prototype.readLocationNames = function(data){
    var devices = data.body.devices;
    var modules = data.body.modules;
    var locations = [];

    // Search in devices (inside of house)
    for (var i = 0; i < devices.length; i++){
        var device = devices[i];
        locations.push(device.module_name);
    }

    // Search in modules (outside of house)
    for (var i = 0; i < modules.length; i++){
        var module = modules[i];
        locations.push(module.module_name);
    }

    return locations;
}


Netatmo.prototype.readModule = function(locationName, data){
    var devices = data.body.devices;
    var modules = data.body.modules;
    var locationName = locationName.toLowerCase();
    var locations = [];

    // Search in devices (inside of house)
    for (var i = 0; i < devices.length; i++){
        var device = devices[i];
        if(device.module_name.toLowerCase() === locationName){
            var ret = device.dashboard_data;
            ret.supported_sensors = device.data_type;
            return ret;
        }
    }

    // Search in modules (outside of house)
    for (var i = 0; i < modules.length; i++){
        var device = modules[i];
        if(device.module_name.toLowerCase() === locationName){
            var ret = device.dashboard_data;
            ret.supported_sensors = device.data_type;
            return ret;
        }
    }

    return null;
}


Netatmo.prototype.getData = function(session, onResponse, onError){

    // If it is already stored in our session, we have nothing to do
    if(session.attributes.data){
        console.log("Loading netatmo data from session.");
        onResponse(session.attributes.data);
        return;
    }

    console.log("Loading netatmo data from https://api.netatmo.net");
    this.getAccessToken(function(accessToken){
        var options = {
            host: 'api.netatmo.net',
            path: '/api/devicelist',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(accessToken)
            }
        };

        var storeIntoSession = function(data){
            session.attributes.data = data;
            onResponse(data);
        }

        sendRequest(accessToken, options, storeIntoSession, onError);
    }, onError);
}


Netatmo.prototype.getAccessToken = function(onResponse, onError){
    var content = querystring.stringify({
        'grant_type'    : 'password',
        'client_id'     : process.env.CLIENT_ID,
        'client_secret' : process.env.CLIENT_SECRET,
        'username'      : process.env.USER_ID,
        'password'      : process.env.PASSWORD,
        'scope'         : 'read_station'
    });

    var options = {
        host: 'api.netatmo.net',
        path: '/oauth2/token',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(content)
        }
    };

    var createAccessToken = function(parsedResponse){
        var accessToken = querystring.stringify({
            'access_token'  : parsedResponse.access_token
        });
        onResponse(accessToken);
    };

    sendRequest(content, options, createAccessToken, onError);
}


function getLocationNameFromIntentSlots(intentSlots){
    if(!intentSlots || !intentSlots.Location || !intentSlots.Location.value){
        return null;
    }

    return intentSlots.Location.value;
}


function sendRequest(content, options, onResponse, onError){
    var responseStr = '';
    var req = https.request(options, function(res) {
        console.log("Status Code | ", res.statusCode);
        console.log("Headers | ", res.headers);

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log("Body Chunk | " + chunk);
            responseStr += chunk;
        });

        res.on('error', function (err) {
            console.log("A res. error occured | "+ err);
        });

        res.on('end', function() {
            var parsedResponse = JSON.parse(responseStr);
            console.log("Parsed body | " + JSON.stringify(parsedResponse));
            if (onResponse) {
                onResponse(parsedResponse);
            }
        });
    });

    req.on('error', function(err){
        console.log('A req. error occured | ' + err)
        onError(err);
    });
    req.write(content);
    req.end();
}


/**
 * Create the handler that responds to the Alexa Request.
 */
exports.handler = function (event, context) {
    var netatmo = new Netatmo();
    netatmo.execute(event, context);
};