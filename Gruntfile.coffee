module.exports = (grunt) ->

  grunt.initConfig
    pkg: grunt.file.readJSON 'package.json'
    coffee:
      compile:
        expand: true
        flatten: true
        cwd: 'coffee/'
        src: ['*.coffee']
        ext: '.js'
    watch:
      scripts:
        files: ['coffee/*.coffee']
        tasks: ['compile']
        options:
          spawn: false

  grunt.loadNpmTasks 'grunt-contrib-coffee'
  grunt.loadNpmTasks 'grunt-contrib-watch'

  grunt.registerTask 'compile', ['coffee']
    # Do stuff

  grunt.registerTask 'default', ['watch']
