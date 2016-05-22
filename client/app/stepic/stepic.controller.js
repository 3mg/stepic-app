'use strict';
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

    $onInit() {
      window.$ctrl = this;
      
      /*this.$http.get('https://stepic.org/api/docs/api-docs/').then(response => {
        this.schema = response.data;
        
        var promises = [];
        
        this.schema.apis.forEach(api => {
          let path = api.path;
          promises.push(
            this.$http.get('https://stepic.org/api/docs/api-docs/'+path.split('/')[2]).then(response => {
              api.apiDeclaration = response.data;
            })
          );
        });
        
        this.$q.all(promises).finally((values) => {
          this.schemaInitialized();
        });
      });*/

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
      }
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
    }
    
    refreshDB() {
      this.resetDB();
      this.initDB();
    }
    
    initDB() {
      let needUpdate = false;
      
      for (let key in this.db) {
        let res = this.db[key].store(this.db_name + '_' + key);
        if (false === res) {
          this.needUpdate = true;
        }
      }
      
      if (needUpdate) {
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
          
          [['sections', 'units'], ['units', 'lessons'], ['lessons', 'steps']].forEach(a => {
            var entityName = a[0], relationName = a[1];
            
            var nextPromises = [];
            var entities = this.db[entityName]().get();
            
            this.$q.all(promises)
            .then(() => {
              entities.foreach(entity => {
                let promise = this['load' + capitalize(relationName)](entity)
                .then(relations => {
                  this.db[relationName].insert(relations);
                });
                nextPromises.push(promise);
              });
            });
            
            promises = nextPromises;
          });
          
        });
        
      }
    }
    
    getCourses() {
      return this.db.courses().get();
    }
    
    getSections(course) {
      return this.db.sections({course: course.id}).get();
    }
    
    getUnits(section) {
      return this.db.units({section: section.id}).get();
    }
    
    getLessons(unit) {
      return this.db.lessoms({unit: unit.id}).get();
    }
    
    getSteps(lesson) {
      return this.db.steps({lesson: lesson.id}).get();
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
    
    loadLessons(unit) {
      return this.$loadRelations(this.api.apiLessons.Lesson_retrieve, unit, 'lessons');
    }
    
    loadSteps(lesson) {
      return this.$loadRelations(this.api.apiSteps.Step_retrieve, lesson, 'steps');
    }
  }

  angular.module('myAppApp')
    .component('stepic', {
      templateUrl: 'app/stepic/stepic.html',
      controller: StepicComponent
    });

})(window.angular, window.TAFFY);
