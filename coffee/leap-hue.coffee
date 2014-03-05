fs = require 'fs'

_ = require 'underscore'
hue = require "node-hue-api"
q = require "q"
prompt = require "prompt"

Leap = require "leapjs"
Speakable = require "speakable"

listening = true


prompt.start()

mmod = (n, m) ->
  ((n % m) + m) % m

getUsernameForBridge = (id) ->
  if fs.existsSync('usernames')
    JSON.parse(fs.readFileSync('usernames', {'encoding': 'utf8'}))[id]

getBridge = ->
  hue.locateBridges().then (bridges) ->
    unless bridges.length > 0
      throw new Error('No bridges detected.')
    else if bridges.length == 1
      bridges[0]
    else
      for bridge, i in bridges
        console.log i, JSON.stringify bridge
      q.nfcall(prompt.get, ['bridge id']).then (result) ->
        bridges[result]

getUser = (bridge) ->
  # Get the username associated with this bridge
  username = getUsernameForBridge bridge.id

  if username
    console.log 'Found existing user:', username
    q username
  else
    (new hue.HueApi()).registerUser(bridge.ipaddress).then (username) ->
      bridgeToUsername = if fs.existsSync('usernames') then JSON.parse(fs.readFileSync('usernames', {'encoding': 'utf8'})) else {}
      bridgeToUsername[bridge.id] = username
      fs.writeFileSync('usernames', JSON.stringify(bridgeToUsername))

      console.log 'Registered new user:', username
      username

hslLights = _.throttle (api, lights, h, s, l) ->
  for light in lights
    console.log 'Setting', light.name, 'to', h, s, l
    api.setLightState light.id, hue.lightState.create().hsl(h, s, l).transition(0.2).on()
, 200

startLeapController = (api, lights) ->
  ctl = new Leap.Controller()
  ctl.on 'frame', (frame) ->

    unless listening and frame.hands.length > 0
      return

    hand = frame.hands[0]
    x = hand.palmPosition[0]
    y = hand.palmPosition[1]
    z = hand.palmPosition[2]

    h = mmod Math.round(x/2), 360
    s = Math.round(y/3)
    l = 50

    hslLights api, lights, h, s, l
  ctl.connect()

startVoiceController = (api, lights) ->
  console.log 'Starting voice controller'
  speakable = new Speakable({
      threshold: '0.5',
    });

  speakable.on 'speechStart', () ->
    console.log 'I hear you'

  speakable.on 'error', (error) ->
    console.log 'Whoops!', error

  speakable.on 'speechResult', (recognizedWords) ->
    console.log "I heard", recognizedWords
    commands =
      'on': (api, lights) ->
        listening = true
        for light in lights
          console.log 'turning on', light
          api.setLightState light.id, hue.lightState.create().white(300, 100).transition(0.2).on()
      'off': (api, lights) ->
        listening = false
        for light in lights
          console.log 'turning off', light
          api.setLightState light.id, hue.lightState.create().transition(0.2).off()

    if (recognizedWords.indexOf 'lights') > -1
      console.log 'heard lights'
      for command, func of commands
        if (recognizedWords.indexOf command) > -1
          console.log 'heard', command
          func(api, lights)

    speakable.recordVoice()

  speakable.recordVoice()

getBridge().then (bridge) ->
  getUser(bridge).then (username) ->
    api = new hue.HueApi bridge.ipaddress, username
    api.searchForNewLights().then ->
      api.lights().then (lights) ->
        console.log 'Found lights', lights

        startLeapController api, lights.lights
        startVoiceController api, lights.lights



.done()
