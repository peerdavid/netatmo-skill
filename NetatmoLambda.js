/*
 * Connect Netatmo Wetterstation and Amazon Alexa
 * 
 * To configure the lambda service, set the environment variables:
 *  CLIENT_ID
 *  CLIENT_SECRET
 *  USER_ID
 *  PASSWORD
 */

/*
 * Includes
 */
var http = require('https'); 
var https = require('https');
var querystring = require('querystring');


// Route the incoming request based on type
exports.handler = function (event, context) {
    try {
        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request, event.session, function callback(sessionAttributes, speechletResponse) {
                context.succeed({
                version: "1.0",
                sessionAttributes: sessionAttributes,
                response: speechletResponse
                });
            });

        }  else if (event.request.type === "IntentRequest") {
            onIntent(event.request, event.session, function callback(sessionAttributes, speechletResponse) {
                context.succeed({
                    version: "1.0",
                    sessionAttributes: sessionAttributes,
                    response: speechletResponse
                });
            });

        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};


function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
            ", sessionId=" + session.sessionId);
}


function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
            ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getDataFromNetatmo(callback);
}


function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent;
    var intentName = intentRequest.intent.name;
    var intentSlots ;

    console.log("intentRequest: "+ intentRequest);  
    if (typeof intentRequest.intent.slots !== 'undefined') {
        intentSlots = intentRequest.intent.slots;
    }

    getDataFromNetatmo(callback,intentName, intentSlots);
}


function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
            ", sessionId=" + session.sessionId);
}


function getDataFromNetatmo(callback, intentName, intentSlots){
    console.log("sending request to netatmo...")

    var payload = querystring.stringify({
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
            'Content-Length': Buffer.byteLength(payload)
        }

    };

    // Get token and set callbackmethod to get measure 
    doCall(payload, options, onReceivedTokenResponse, callback, intentName, intentSlots);
}


function doCall(payload, options, onResponse,
                callback, intentName, intentSlots){

    var req = https.request(options, function(res) {
        console.log("statusCode: ", res.statusCode);
        console.log("headers: ", res.headers);

        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log("body: " + chunk);
            var parsedResponse = JSON.parse(chunk);
            if (typeof onResponse !== 'undefined') {
                onResponse(parsedResponse, callback, intentName, intentSlots);
            }

        });

        res.on('error', function (chunk) {
            console.log('Error: '+chunk);
        });

        res.on('end', function() {
            //callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
        });
    });

    req.on('error', function(e){
        console.log('error: '+e)
    });
    req.write(payload);
    req.end();
}


function onReceivedTokenResponse(parsedResponse, callback, intentName, intentSlots){
    var payload = querystring.stringify({
        'access_token'  : parsedResponse.access_token
    });

    var options = {
        host: 'api.netatmo.net',
        path: '/api/devicelist',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(payload)
        }

    };

    doCall(payload, options, getMeasure, callback, intentName, intentSlots);
}


/**
 * Modules -> Are outside 
 * Devices -> Are inside
 * 
 * The name of the module / device is (in my case) the name of the room,
 * which is set in the settings of netatmo. So this service is more generic
 * and modules / devices can easily be added without modifications of the
 * lambda service
 */
function getMeasure(parsedResponse, callback, intentName, intentSlots) {

    // If we get no informations, we return always all values from outside
    var locationName = !intentSlots || !intentSlots.Location || !intentSlots.Location.value 
        ? "aussen" 
        : intentSlots.Location.value;
    var im = locationName == "aussen" ? "" : "im ";    // Its the word im -> Temperatur IM wohnzimmer or temperatur '' aussen
    var speechOutput;
    var currentDevice;
    var supportedSensors;
    var devices = parsedResponse.body.devices;
    var modules = parsedResponse.body.modules;

    // Search in devices
    for (var i = 0; i < devices.length; i++){
        var device = devices[i];
        if(device.module_name.toLowerCase() === locationName){
            currentDevice = device.dashboard_data;
            supportedSensors = device.data_type;
            break;
        }
    }

    // If we could not find it in the devices, search in modules
    if(!currentDevice){
         for (var i = 0; i < modules.length; i++){
            var device = modules[i];
            if(device.module_name.toLowerCase() === locationName){
                currentDevice = device.dashboard_data;
                supportedSensors = device.data_type;
                break;
            }
        }
    }

    // Check if we found it
    if(!currentDevice){
        response(callback, "Ich konnte keine Station " + im + locationName + " finden.");
        return;
    }

    // Return the values for all sensors of a given station
    var responseText = "";
    if(intentName == "ALL") {
        for(var i = 0; i < supportedSensors.length; i++){
            responseText += getResponseTextForSensor(currentDevice, supportedSensors[i], im, locationName);
        }
        
        response(callback, responseText);
        return;
    }

    // Output value for one single sensor
    sensorName = convertIntentToSensorName(intentName);
    if(!currentDevice[sensorName]){
        response(callback, "Die Station " + im + locationName + " hat diesen Sensor nicht eingebaut.");
        return;
    }

    responseText = getResponseTextForSensor(currentDevice, sensorName, im, locationName);
    response(callback, responseText);
}


function convertIntentToSensorName(intentName){
    if(intentName === "COZWEI"){
        return "CO2";
    }

    return intentName;
}


function getResponseTextForSensor(currentDevice, sensorName, im, locationName){
    var val = convertToGermanNumber(currentDevice[sensorName]);
    if(sensorName === "Temperature")  {
        return im + locationName + " hat es " + val + " grad.";

    } else if (sensorName === "CO2"){
        return "Der CO2-Wert " + im + locationName + " beträgt " + val + " ppm.";

    } else if( sensorName === "Humidity"){
        return "Die Luftfeuchtigkeit " + im + locationName + " beträgt " + val + " prozent.";

    }  else if( sensorName === "Noise"){
        return "Die Lautstärke " + im + locationName + " beträgt " + val + " dezibel.";
    
    } else if( sensorName === "Pressure"){
        return "Der Luftdruck " + im + locationName + " beträgt " + val + " milli bar.";
    }


    // Unknown sensor, use default
    return "Der " + sensorName + " wert liegt bei " + val;
}


function convertToGermanNumber(num){
    return num.toString().replace(".", ",");
}


function response(callback, output) {
    var responseObject = {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: "SessionSpeechlet - ",
            content: "SessionSpeechlet - " + output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: null
            }
        },
        shouldEndSession: true
    };

    callback({}, responseObject);
}
