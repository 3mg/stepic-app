'use strict';

angular.module('myAppApp.auth', [
  'myAppApp.constants',
  'myAppApp.util',
  'ngCookies',
  'ui.router'
])
  .config(function($httpProvider) {
    $httpProvider.interceptors.push('authInterceptor');
  });
