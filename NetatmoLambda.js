/*
 * Connect Netatmo Wetterstation and Amazon Alexa
 * 
 * Set the following environment variables in your lambda service:
 *  CLIENT_ID
 *  CLIENT_SECRET
 *  USER_ID
 *  PASSWORD
 * 
 * See Also:
 * https://github.com/peerdavid/netatmo-alexa
 * http://stackoverflow.com/questions/33859826/linking-netatmo-weather-station-to-amazon-echo-alexa
 */

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
        context.fail("Exception | " + e);
    }
};


function onSessionStarted(sessionStartedRequest, session) {
    console.log("OnSessionStarted Event" +
        " | requestId: " + sessionStartedRequest.requestId +
        " | sessionId: " + session.sessionId);
}


function onLaunch(launchRequest, session, callback) {
    console.log("OnLaunch Event" + 
        " | RequestId: " + launchRequest.requestId +
        " | SessionId: " + session.sessionId);

    getTokenFromNetatmo(callback);
}


function onIntent(intentRequest, session, callback) {
    var intent = intentRequest.intent;
    var intentName = intentRequest.intent.name;
    var intentSlots ;
  
    if (typeof intentRequest.intent.slots !== 'undefined') {
        intentSlots = intentRequest.intent.slots;
    }

    console.log("OnIntent Event"+ 
        " | RequestId:" + intentRequest.requestId + 
        " | SessionId: " + session.sessionId +
        " | IntentName: " + intentName + 
        " | IntentSlots: " + intentSlots);

    getTokenFromNetatmo(callback, intentName, intentSlots);
}


function onSessionEnded(sessionEndedRequest, session) {
    console.log("Session ended" +
        " | RequestId: " + sessionEndedRequest.requestId +
        " | SessionId: " + session.sessionId);
}


function getTokenFromNetatmo(callback, intentName, intentSlots){
    console.log("Reading token from netatmo.")

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

    request(content, options, onReceivedTokenResponse, callback, intentName, intentSlots);
}


function onReceivedTokenResponse(parsedResponse, callback, intentName, intentSlots){
    var content = querystring.stringify({
        'access_token'  : parsedResponse.access_token
    });

    var options = {
        host: 'api.netatmo.net',
        path: '/api/devicelist',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(content)
        }
    };

    request(content, options, handleNetatmoResponse, callback, intentName, intentSlots);
}


function request(content, options, onResponse, callback, intentName, intentSlots){

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
                onResponse(parsedResponse, callback, intentName, intentSlots);
            }
        });
    });

    req.on('error', function(err){
        console.log('A req. error occured | ' + err)
    });
    req.write(content);
    req.end();
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
function handleNetatmoResponse(parsedResponse, callback, intentName, intentSlots) {

    // If we get no informations, we return always all values from outside
    var locationName = ""
    if(!intentSlots || !intentSlots.Location || !intentSlots.Location.value){
        locationName = "aussen";
        intentName = "ALL";
    } else {
        locationName = intentSlots.Location.value;
    }

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
        response(callback, "Ich konnte keine Station " + im + locationName + " finden. \n");
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
    if(currentDevice[sensorName] == null){
        response(callback, "Die Station " + im + locationName + " hat diesen Sensor nicht eingebaut. \n");
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
        return im + locationName + " hat es " + val + " grad. \n";

    } else if (sensorName === "CO2"){
        return "Der CO2-Wert " + im + locationName + " beträgt " + val + " ppm. \n";

    } else if( sensorName === "Humidity"){
        return "Die Luftfeuchtigkeit " + im + locationName + " beträgt " + val + " prozent. \n";

    }  else if( sensorName === "Noise"){
        return "Die Lautstärke " + im + locationName + " beträgt " + val + " dezibel. \n";
    
    } else if( sensorName === "Pressure"){
        return "Der Luftdruck " + im + locationName + " beträgt " + val + " milli bar. \n";
    }


    // Unknown sensor, use default
    return "Der " + sensorName + " wert liegt bei " + val + ". \n";
}


function convertToGermanNumber(num){
    return num.toString().replace(".", ",");
}


function response(callback, output) {
    console.log("Response | " + output);

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
