'use strict';
/*global localStorage*/
/*global moment*/
(function(angular, TAFFY) {

  class StepicComponent {
    constructor($q, $http, $scope, swaggerClient, $cookies) {
      this.client_id = 'bYD2dvnypHcCigTQ5jIDU28KjaoGi6dDfjdrWN2x';
      this.client_secret = 'NGcrUXwGp3h6yDeMw165S7rmpB6ZQbUJigXPSpHi3oH5nQNrgtv370rg2iK8ch3B4USha7NCExzRCgGnM2XWsC3qbLZjItWItQpl0qBP3Nqsct9VWZh1ziFmSRd58iTk';
      this.user_id = '16032241';
      this.db_name = 'stepic';

      this.$q = $q;
      this.$http = $http;
      this.$scope = $scope;
      this.swaggerClient = swaggerClient;
      this.$cookies = $cookies;
      
      this.needUpdate = false;
      
      this.db = {
        'courses': TAFFY(),
        'sections': TAFFY(),
        'units': TAFFY(),
        'lessons': TAFFY(),
        'steps': TAFFY()
      };

      this.api = null;
      this._schema = {};
      this.schema = {};
      
      this.sections = {};
    }
    
    getLastUpdated() {
      var lastUpdated = localStorage.getItem('stepic_last_updated');
      if(!lastUpdated) {
        return null;
      }
      return new Date(parseInt(lastUpdated));
    }
    
    setLastUpdated() {
      localStorage.setItem('stepic_last_updated', +new Date);
    }

    $onInit() {
      window.$ctrl = this;
      
      let ONE_HOUR = 60 * 60 * 1000;
      this.needUpdate = this.getLastUpdated() < (new Date() - ONE_HOUR * 10);
      
      this.$http.get('/assets/json/stepic.json').then(response => {
        this._schema = response.data;
        angular.copy(response.data, this.schema);
        this.schemaInitialized();
      });
    }

    schemaInitialized() {
      this.api = this.swaggerClient(this._schema);

      this.oAuth().then(response => {
        this.authResourse(this.api.apiUsers.User_retrieve, this.user_id)
        .then(response => {
          this.$scope.user = response.data.users[0];
        });
        
        this.initDB();
      });
    }
    
    oAuth() {
      var req = {
        method: 'POST',
        url: 'https://stepic.org/oauth2/token/',
        headers: {
          'Authorization': 'Basic ' + btoa(this.client_id + ':' + this.client_secret),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        transformRequest: function(obj) {
          var str = [];
          for (var p in obj)
            str.push(encodeURIComponent(p) + "=" + encodeURIComponent(obj[p]));
          return str.join("&");
        },
        data: {
          'grant_type': 'client_credentials'
        }
      };
      return this.$http(req).then(response => {
        this.token = response.data;
        this.api.auth(this.token.access_token);
      });
    }
    
    authResourse(resource, data, options) {
      options = options || {};
      options['headers'] = options['headers'] || {};
      options['headers']['Authorization'] = 'Bearer ' + this.token.access_token;
      return resource.apply(resource, [data, options])
    }
     
    resetDB() {
      for (let key in this.db) {
        this.db[key]().remove();
      }
      this.needUpdate = true;
    }
    
    refreshDB() {
      this.$scope.$applyAsync(() => {
        this.resetDB();
        this.initDB();
      });
    }
    
    initDB() {
      for (let key in this.db) {
        let res = this.db[key].store(this.db_name + '_' + key);
        if (false === res) {
          this.needUpdate = true;
        }
      }
      
      if (this.needUpdate) {
        this.resetDB();
        
        this.loadCourses()
        .then(courses => {
          this.db.courses.insert(courses);
        
          var promises = [];
          
          courses.forEach(course => {
            let promise = this.loadSections(course)
            .then(sections => {
              this.db.sections.insert(sections);
            });
            promises.push(promise);
          });
          
          var capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
          
          let load = (list, i, promises, onComplete) => {
            if (i >= list.length) {
              onComplete();
              return;
            }
            
            var 
              entityName = list[i][0], 
              relationName = list[i][1],
              dbName = list[i][2];
            
            var nextPromises = [];
            
            this.$q.all(promises)
            .then(() => {
              let entities = this.db[entityName]().get();
            
              entities.forEach(entity => {
                let promise = this['load' + capitalize(relationName)](entity)
                .then(relations => {
                  this.db[dbName].insert(relations);
                });
                nextPromises.push(promise);
              });
              
              load(list, i + 1, nextPromises, onComplete);
            }, function() {
              console.log(arguments);
            });
          };
          
          load([['sections', 'units', 'units'], ['units', 'lesson', 'lessons']/*, ['lessons', 'steps', 'steps']*/], 0, promises, this.$onLoaded);
          
        });
        
        this.needUpdate = false;
        this.setLastUpdated();
      } else {
        this.$onLoaded();
      }
    }
    
    $onLoaded() {
      this.$scope.workload = this.getHoursPerWeek();
    }
    
    getCourses() {
      var courses = this.db.courses().get();
      var self = this;
      
      return _.sortBy(courses, function(course) { 
        let deadlines = self.getNextDeadlines(course);
        
        let s = deadlines.soft ? +moment(deadlines.soft) : Infinity;
        let h = deadlines.hard ? +moment(deadlines.hard) : Infinity;
        
        return Math.min(s, h); 
      });
    }
    
    getSections(course) {
      return this.db.sections({course: course.id}).order('position asec').get();
    }
    
    getUnits(section) {
      return this.db.units({section: section.id}).order('position asec').get();
    }
    
    getLesson(unit) {
      return this.db.lessons({id: unit.lesson}).get()[0];
    }
    
    getSteps(lesson) {
      return this.db.steps({lesson: lesson.id}).get();
    }
    
    
    getNextDeadlines(course) {
      let soft = this.db.sections({course: course.id}, function () {
        return moment(this.soft_deadline) > moment(); 
      }).order('soft_deadline asec').get();
      
      let hard = this.db.sections({course: course.id}, function () {
        return moment(this.hard_deadline) > moment(); 
      }).order('hard_deadline asec').get();
      
      if (soft.length > 0 && hard.length > 0) {
        return {soft:soft[0], hard:hard[0]};
      } else if (hard.length > 0) {
        return {soft:null, hard:hard[0]};
      }
      return {soft:null, hard:null};
    }
    
    getHoursPerWeek() {
      var courses = this.db.courses().get();
      //console.log(courses);
      
      var parseWorkload = (w) => {
        var match = w.match(/.*?([0-9]+)(\s*[-–]\s*)?([0-9]+)?.*?/);
        
        if (!match) {
          return [5, 6]; // default workload
        }
        
        var from = parseInt(match[1]), to = parseInt(match[3]) ? parseInt(match[3]) : from;
        
        if( w.indexOf("мин") >= 0 || w.indexOf("min") >= 0 ) {
          from /= 60;
          to /= 60;
        }
        
        return [from, to];
      };
      
      var from = 0, to = 0;
      var uFrom = 0, uTo = 0;
      
      courses.forEach(course => {
        let w = parseWorkload(course.workload);
        
        from += w[0];
        to += w[1];
        
        let deadlines = this.getNextDeadlines(course);
        if (deadlines.soft || deadlines.hard) {
          uFrom += w[0];
          uTo += w[1];
        }
      });
      
      return {
        all: [from, to],
        urgent: [uFrom, uTo]
      };
    }
    
    
    $loadEntities(api, entityName, options) {
      var deferred = this.$q.defer();
      
      this.authResourse(api, options)
      .then((response) => {
        deferred.resolve(response.data[entityName]);
        
      }, (response) => {
        deferred.reject(response);
        
      });
      
      return deferred.promise;
    }
    
    $loadRelations(api, entity, relationName/*, options*/) {
      var relatedEntities = [];
      
      var deferred = this.$q.defer(), promises = [];
      
      entity[relationName].forEach(id => {
        let promise = this.authResourse(api, {pk: id.toString()});
        promises.push(promise);
        
        promise.then( (response) => {
          relatedEntities.push(response.data[relationName][0]);
        }, (response) => {
          console.log(response);
        });
        
      });
      
      this.$q.all(promises).then((values) => {
        deferred.resolve(relatedEntities);
        
      }, (values) => {
        deferred.reject(values);
        
      });
      
      return deferred.promise;
    }
    
    loadCourses() {
      return this.$loadEntities(this.api.apiCourses.Course_list, 'courses', {'enrolled': true});
    }
    
    loadSections(course) {
      return this.$loadRelations(this.api.apiSections.Section_retrieve, course, 'sections');
    }
    
    loadUnits(section) {
      return this.$loadRelations(this.api.apiUnits.Unit_retrieve, section, 'units');
    }
    
    loadLesson(unit) {
      return this.$loadEntities(this.api.apiLessons.Lesson_retrieve, 'lessons', { pk: unit.lesson.toString() });
    }
    
    loadSteps(lesson) {
      return this.$loadRelations(this.api.apiSteps.Step_retrieve, lesson, 'steps');
    }
  }

  angular.module('myAppApp')
    .component('stepic', {
      templateUrl: 'app/stepic/stepic.html',
      controller: StepicComponent
    })
    .directive('lesson', function() {
        return {
            restrict: "A",
            link: function (scope, element, attrs, controller) {
              scope.lesson = scope.$eval(attrs.lesson);
            }
        }
    })
    .directive('countdown', function($interval) {
        return {
            restrict: "A",
            link: function (scope, element, attrs, controller) {
              var date = scope.$eval(attrs.countdown), now, diff;
              
              if (!date) return;
              
              date = +moment(date);
              
              let f = () => {
                now = +new Date();
                diff = Math.floor( (date - now) / 1000 ); // in seconds

                var dSeconds = 60 * 60 * 24, hSeconds = 3600;

                var days = Math.floor(diff / dSeconds),
                    hours = Math.floor( (diff - days * dSeconds) / hSeconds ),
                    minutes = Math.floor( (diff - days * dSeconds - hours * hSeconds) / 60 );

                // var diff = moment.(date.diff(moment())).format('D \\d, H \\h, m \\m');

                var diff = `${days} d, ${hours} h, ${minutes} m`;

                element.html(diff);
              };
              f();
              $interval(f, 60000);
            }
        }
    })
    .directive('deadlines', function() {
        return {
            restrict: "A",
            scope: true,
            link: function (scope, element, attrs, controller) {
              scope.deadlines = scope.$eval(attrs.deadlines);
            },
            template: 
              '<div class="row">' +
              '<div class="col-md-6" ng-if="deadlines.soft"><h5>Next soft deadline:<br/><b>{{ deadlines.soft.title }}</b><br/>[{{ deadlines.soft.soft_deadline | date }}]</h5><p><span countdown="deadlines.soft.soft_deadline"></span></p></div>' +
              '<div class="col-md-6" ng-if="deadlines.hard"><h5>Next hard deadline:<br/><b>{{ deadlines.hard.title }}</b><br/>[{{ deadlines.soft.hard_deadline | date }}]</h5><p><span countdown="deadlines.hard.hard_deadline"></span></p></div>' +
              '</div>'
        }
    })
    
  ;

})(window.angular, window.TAFFY);
