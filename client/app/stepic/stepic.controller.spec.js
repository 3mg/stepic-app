'use strict';

describe('Component: StepicComponent', function () {

  // load the controller's module
  beforeEach(module('myAppApp'));

  var StepicComponent, scope;

  // Initialize the controller and a mock scope
  beforeEach(inject(function ($componentController, $rootScope) {
    scope = $rootScope.$new();
    StepicComponent = $componentController('StepicComponent', {
      $scope: scope
    });
  }));

  it('should ...', function () {
    expect(1).toEqual(1);
  });
});
