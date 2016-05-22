'use strict';

angular.module('ui.bootstrap.affix', [])
.directive('affix', ['$window', function ($window) {
    return {
        $scope: true,
        restrict: 'A',
        link: function ($scope, $element, $attrs) {
            $element.affix();
            
            var width;
            
            $element.on('affix.bs.affix', function() {
                width = $element.width();
            });
            
            $element.on('affixed.bs.affix', function() {
                $element.width(width);
            });
            
            $scope.$on('$destroy', function() {
                //$window.off('.affix');
                $element.removeData('bs.affix').removeClass('affix affix-top affix-bottom');
            });
        }
    };
}]);