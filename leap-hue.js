(function() {
  var Leap, Speakable, fs, getBridge, getUser, getUsernameForBridge, hslLights, hue, listening, mmod, prompt, q, startLeapController, startVoiceController, _;

  fs = require('fs');

  _ = require('underscore');

  hue = require("node-hue-api");

  q = require("q");

  prompt = require("prompt");

  Leap = require("leapjs");

  Speakable = require("speakable");

  listening = true;

  prompt.start();

  mmod = function(n, m) {
    return ((n % m) + m) % m;
  };

  getUsernameForBridge = function(id) {
    if (fs.existsSync('usernames')) {
      return JSON.parse(fs.readFileSync('usernames', {
        'encoding': 'utf8'
      }))[id];
    }
  };

  getBridge = function() {
    return hue.locateBridges().then(function(bridges) {
      var bridge, i, _i, _len;
      if (!(bridges.length > 0)) {
        throw new Error('No bridges detected.');
      } else if (bridges.length === 1) {
        return bridges[0];
      } else {
        for (i = _i = 0, _len = bridges.length; _i < _len; i = ++_i) {
          bridge = bridges[i];
          console.log(i, JSON.stringify(bridge));
        }
        return q.nfcall(prompt.get, ['bridge id']).then(function(result) {
          return bridges[result];
        });
      }
    });
  };

  getUser = function(bridge) {
    var username;
    username = getUsernameForBridge(bridge.id);
    if (username) {
      console.log('Found existing user:', username);
      return q(username);
    } else {
      return (new hue.HueApi()).registerUser(bridge.ipaddress).then(function(username) {
        var bridgeToUsername;
        bridgeToUsername = fs.existsSync('usernames') ? JSON.parse(fs.readFileSync('usernames', {
          'encoding': 'utf8'
        })) : {};
        bridgeToUsername[bridge.id] = username;
        fs.writeFileSync('usernames', JSON.stringify(bridgeToUsername));
        console.log('Registered new user:', username);
        return username;
      });
    }
  };

  hslLights = _.throttle(function(api, lights, h, s, l) {
    var light, _i, _len, _results;
    _results = [];
    for (_i = 0, _len = lights.length; _i < _len; _i++) {
      light = lights[_i];
      console.log('Setting', light.name, 'to', h, s, l);
      _results.push(api.setLightState(light.id, hue.lightState.create().hsl(h, s, l).transition(0.2).on()));
    }
    return _results;
  }, 200);

  startLeapController = function(api, lights) {
    var ctl;
    ctl = new Leap.Controller();
    ctl.on('frame', function(frame) {
      var h, hand, l, s, x, y, z;
      if (!(listening && frame.hands.length > 0)) {
        return;
      }
      hand = frame.hands[0];
      x = hand.palmPosition[0];
      y = hand.palmPosition[1];
      z = hand.palmPosition[2];
      h = mmod(Math.round(x / 2), 360);
      s = Math.round(y / 3);
      l = 50;
      return hslLights(api, lights, h, s, l);
    });
    return ctl.connect();
  };

  startVoiceController = function(api, lights) {
    var speakable;
    console.log('Starting voice controller');
    speakable = new Speakable({
      threshold: '0.5'
    });
    speakable.on('speechStart', function() {
      return console.log('I hear you');
    });
    speakable.on('error', function(error) {
      return console.log('Whoops!', error);
    });
    speakable.on('speechResult', function(recognizedWords) {
      var command, commands, func;
      console.log("I heard", recognizedWords);
      commands = {
        'on': function(api, lights) {
          var light, _i, _len, _results;
          listening = true;
          _results = [];
          for (_i = 0, _len = lights.length; _i < _len; _i++) {
            light = lights[_i];
            console.log('turning on', light);
            _results.push(api.setLightState(light.id, hue.lightState.create().white(300, 100).transition(0.2).on()));
          }
          return _results;
        },
        'off': function(api, lights) {
          var light, _i, _len, _results;
          listening = false;
          _results = [];
          for (_i = 0, _len = lights.length; _i < _len; _i++) {
            light = lights[_i];
            console.log('turning off', light);
            _results.push(api.setLightState(light.id, hue.lightState.create().transition(0.2).off()));
          }
          return _results;
        }
      };
      if ((recognizedWords.indexOf('lights')) > -1) {
        console.log('heard lights');
        for (command in commands) {
          func = commands[command];
          if ((recognizedWords.indexOf(command)) > -1) {
            console.log('heard', command);
            func(api, lights);
          }
        }
      }
      return speakable.recordVoice();
    });
    return speakable.recordVoice();
  };

  getBridge().then(function(bridge) {
    return getUser(bridge).then(function(username) {
      var api;
      api = new hue.HueApi(bridge.ipaddress, username);
      return api.searchForNewLights().then(function() {
        return api.lights().then(function(lights) {
          console.log('Found lights', lights);
          startLeapController(api, lights.lights);
          return startVoiceController(api, lights.lights);
        });
      });
    });
  }).done();

}).call(this);
