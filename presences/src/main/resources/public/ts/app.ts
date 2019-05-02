import {model, ng, routes} from 'entcore';
import {rights} from './rights'
import * as controllers from './controllers';
import * as directives from './directives';

for (let controller in controllers) {
    ng.controllers.push(controllers[controller]);
}

for (let directive in directives) {
    ng.directives.push(directives[directive]);
}

routes.define(function($routeProvider){
	$routeProvider
        .when('/dashboard', {
            action: 'dashboard'
        })
        .when('/absences', {
            action: 'absences'
        })
        .when('/group-absences', {
            action: 'group-absences'
        })
        .when('/exemptions', {
            action: 'exemptions'
        })
		.otherwise({
            redirectTo: '/dashboard'
		});


    if (model.me.hasWorkflow(rights.workflow.readRegister)) {
        $routeProvider.when('/registers', {
            action: 'registers'
        });
    }
});