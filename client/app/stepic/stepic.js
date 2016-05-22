'use strict';

angular.module('myAppApp')
  .config(function ($stateProvider) {
    $stateProvider
      .state('stepic', {
        url: '/stepic',
        template: '<stepic></stepic>'
      });
  });
