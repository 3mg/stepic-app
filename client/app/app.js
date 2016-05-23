'use strict';

angular.module('myAppApp', [
  'myAppApp.auth',
  'myAppApp.admin',
  'myAppApp.constants',
  'ngCookies',
  'ngResource',
  'ngSanitize',
  'btford.socket-io',
  'ui.router',
  'ui.bootstrap',
  'ui.bootstrap.affix',
  'validation.match',
  'swagger-client',
  'angularMoment'
])
  .config(function($urlRouterProvider, $locationProvider) {
    $urlRouterProvider
      .otherwise('/');

    $locationProvider.html5Mode(true);
  });
