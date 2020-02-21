import {_, angular, idiom as lang, model, moment, ng} from 'entcore';
import {Action, ActionBody, Event, EventResponse, Events, EventType, Student, Students} from "../models";
import {DateUtils} from "@common/utils";
import {GroupService} from "@common/services/GroupService";
import {actionService, EventService, ReasonService} from "../services";
import {EventsFilter, EventsUtils} from "../utilities";
import {Reason} from "@presences/models/Reason";

declare let window: any;

interface ViewModel {
    filter: EventsFilter;
    formFilter: any;

    /* Get reasons type */
    eventReasonsType: Reason[];
    eventReasonsTypeDescription: Reason[];
    eventReasonsId: number[];

    /* Events */
    eventType: number[];
    event: Event;
    events: Events;
    multipleSelect: Reason;
    provingReasonsMap: any;

    /* Filters and actions lightbox*/
    lightbox: {
        filter: boolean;
        action: boolean;
    }

    /* Get actions type */
    actionType: Action[];
    actionAbbreviation: string;
    actionEvent: ActionBody[];
    actionForm: ActionBody;
    action_typeId: string;
    action: {
        seeAll: boolean;
    };

    eventTypeState(periods, event): string;

    editPeriod($event, event): void;

    reasonSelect($event): void;

    getRegularizedValue(event): boolean;

    filterSelect(options: Reason[], event): Reason[];

    downloadFile($event): void;

    stopAbsencePropagation($event): void;

    regularizedChecked(event: EventResponse): boolean;

    changeAllReason(event: EventResponse): Promise<void>;

    changeReason(history: Event, event: EventResponse): Promise<void>;

    toggleAllEventsRegularised(event: EventResponse): Promise<void>;

    toggleEventRegularised(history: Event, event: EventResponse): Promise<void>;

    hasEventsAllRegularized(event: Event[]): boolean;

    hideGlobalCheckbox(event): boolean;

    formatDate(date: string): string;

    /* Action */
    doAction($event, event, eventParent?): void;

    getLastAction(): void;

    createAction(): void;

    showHistory(): void;

    /* Open filter lightbox */
    openForm(): void;

    validForm(): void;

    /* Open action lightbox */

    validActionForm(): void;

    /* Collapse event */
    eventId: number;
    collapse: boolean;

    toggleCollapse(event): void;

    isCollapsibleOpen($index): boolean;

    /* Students */
    studentSearchInput: string;
    students: Students;

    /* Students lightbox */
    studentSearchInputLightbox: string;
    studentsLightbox: Students;

    searchByStudent(string: string): void;

    searchByStudentFromLightbox(string: string): void;

    selectStudent(model: Student, option: Student): void;

    selectStudentFromLightbox(value: string, student: Student): void;

    selectStudentFromDashboard(model: Student, option: Student): void;

    excludeStudentFromFilter(audience): void;

    excludeStudentFromFilterLightbox(audience): void;

    /* Classes */
    classesSearchInput: string;
    classes: any;
    classesFiltered: any[];

    /* Classes Lightbox */
    classesSearchInputLightbox: string;
    classesFilteredLightbox: any[];

    searchByClass(value: string): Promise<void>;

    searchByClassFromLightbox(value: string): Promise<void>;

    selectClass(model: any, option: any): void;

    selectClassFromLightbox(value: string, classes: any): void;

    excludeClassFromFilter(audience): void;

    excludeClassFromFilterLightbox(audience): void;

    /* update filter */
    updateFilter(student?, audience?): void;

    updateDate(): void;

    /*  switch event type */
    switchAbsencesFilter(): void;

    switchLateFilter(): void;

    switchDepartureFilter(): void;

    /*  switch reasons */
    switchReason(reason: Reason): void;

    switchAllReasons(): void;

    /*  switch state */
    switchUnjustifiedFilter(): void;

    switchjustifiedNotRegularizedFilter(): void;

    switchjustifiedRegularizedFilter(): void;

    adaptEvent(): void;

    adaptReason(): void;

    /* Export*/
    exportPdf(): void;

    exportCsv(): void;
}

export const eventsController = ng.controller('EventsController', ['$scope', '$route', '$location',
    'GroupService', 'ReasonService', 'EventService',
    function ($scope, $route, $location, GroupService: GroupService, ReasonService: ReasonService, eventService: EventService) {
        const isWidget = $route.current.action === 'dashboard';
        const vm: ViewModel = this;
        vm.filter = {
            startDate: isWidget ? DateUtils.add(new Date(), -5, "d") : DateUtils.add(new Date(), -30, "d"),
            endDate: isWidget ? DateUtils.add(new Date(), -1, "d") : moment().endOf('day').toDate(),
            students: [],
            classes: [],
            absences: true,
            departure: true,
            late: $route.current.action !== 'dashboard',
            regularized: true,
            regularizedNotregularized: false,
            allReasons: true,
            noReasons: true,
            reasons: {} as Reason,
            unjustified: true,
            justifiedNotRegularized: true,
            justifiedRegularized: false,
            noFilter: true
        };
        vm.provingReasonsMap = {};
        vm.eventType = [];
        vm.multipleSelect = {
            id: 0,
            label: lang.translate("presences.absence.select.multiple"),
            structure_id: "",
            comment: "",
            default: false,
            proving: false,
            group: false
        } as Reason;
        vm.studentSearchInput = '';
        vm.classesSearchInput = '';
        vm.students = new Students();
        vm.studentsLightbox = new Students();
        vm.classesFiltered = undefined;
        vm.classesFilteredLightbox = undefined;

        vm.event = new Event(0, "", "", "");
        vm.events = new Events();
        vm.events.regularized = isWidget ? vm.filter.regularized : null;
        vm.events.eventer.on('loading::true', () => $scope.safeApply());
        vm.events.eventer.on('loading::false', () => {
            filterHistory();
            vm.eventId = null;
            $scope.safeApply();
        });
        vm.lightbox = {
            filter: false,
            action: false
        };
        vm.eventReasonsId = [];
        vm.actionForm = {} as ActionBody;
        vm.action = {
            seeAll: false
        };
        const getEvents = async (actionMode?: boolean): Promise<void> => {
            vm.events.structureId = window.structure.id;
            vm.events.startDate = vm.filter.startDate.toDateString();
            vm.events.endDate = vm.filter.endDate.toDateString();
            vm.events.regularized = vm.filter.regularized;

            if (vm.filter.absences) {
                if (!vm.eventType.some(e => e == EventType.ABSENCE)) {
                    vm.eventType.push(EventType.ABSENCE);
                }
            }
            if (vm.filter.late) {
                if (!vm.eventType.some(e => e == EventType.LATENESS)) {
                    vm.eventType.push(EventType.LATENESS);
                }
            }
            if (vm.filter.departure) {
                if (!vm.eventType.some(e => e == EventType.DEPARTURE)) {
                    vm.eventType.push(EventType.DEPARTURE);
                }
            }
            vm.events.eventType = vm.eventType.toString();

            if (vm.filter.unjustified) {
                vm.eventReasonsId = [];
                vm.filter.noReasons = true;
                vm.events.noReason = vm.filter.noReasons;
            }

            /* fetch all reasons */
            vm.eventReasonsType = await ReasonService.getReasons(window.structure.id);
            vm.eventReasonsTypeDescription = _.clone(vm.eventReasonsType);
            vm.eventReasonsType.map((reason: Reason) => {
                reason.isSelected = true;
                vm.provingReasonsMap[reason.id] = reason.proving;
            });

            if (!isWidget) vm.eventReasonsType.push(vm.multipleSelect);

            EventsUtils.setStudentToSync(vm.events, vm.filter);
            EventsUtils.setClassToSync(vm.events, vm.filter);
            // actionMode to define if we display the loading icon mode while changing filter, date etc...
            if (!actionMode) {
                // "page" uses sync() method at the same time it sets 0 (See LoadingCollection Class)
                vm.updateFilter();
            } else {
                // dynamic mode : case if we only interact with action, reason, counsellor regularized...
                await refreshGetEventWhileAction();
            }
            $scope.safeApply();
        };

        // Events actions
        const getActions = async (): Promise<void> => {
            vm.actionType = await actionService.getActions(window.structure.id);
        };

        const getEventActions = async (): Promise<void> => {
            vm.actionEvent = await eventService.getEventActions(vm.actionForm.eventId[0]);
            $scope.safeApply();
        };

        const filterHistory = (): void => {
            vm.events.all = vm.events.all.filter(e => e.exclude !== true);
            vm.events.all = vm.events.all.sort((a: EventResponse, b: EventResponse) =>
                moment(b.date).format(DateUtils.FORMAT["YEARMONTHDAY"]) -
                moment(a.date).format(DateUtils.FORMAT["YEARMONTHDAY"])
            )
        };

        const refreshGetEventWhileAction = async (): Promise<void> => {
            let filter = {
                structureId: vm.events.structureId,
                startDate: vm.events.startDate,
                endDate: vm.events.endDate,
                noReason: vm.events.noReason,
                eventType: vm.events.eventType,
                listReasonIds: vm.events.listReasonIds,
                regularized: vm.events.regularized,
                userId: vm.events.userId,
                classes: vm.events.classes,
                page: vm.events.page
            };
            let events = await eventService.get(filter);

            vm.events.pageCount = events.pageCount;
            vm.events.events = events.events;
            vm.events.all = events.all;
            filterHistory();
            $scope.safeApply();
        };

        vm.formatDate = function (date: string) {
            return DateUtils.format(date, DateUtils.FORMAT["DAY-MONTH-HALFYEAR"]);
        };

        vm.createAction = function () {
            eventService.createAction(vm.actionForm);
            getEvents(true);
        };

        vm.editPeriod = ($event, {studentId, date, displayName, className, classId}): void => {
            $event.stopPropagation();
            window.item = {
                id: studentId,
                date,
                displayName,
                type: 'USER',
                groupName: className,
                groupId: classId,
                toString: function () {
                    return this.displayName;
                }
            };
            $location.path(`/calendar/${studentId}?date=${date}`);
            $scope.safeApply();
        };

        /* Change CSS class depending on their event_type id */
        vm.eventTypeState = (periods, event): string => {
            if (periods.events.length === 0) return '';
            const priority = [EventType.ABSENCE, EventType.LATENESS, EventType.DEPARTURE, EventType.REMARK];
            const className = ['absent', 'late', 'departure', 'remark', 'justified', 'empty'];
            let index = 4;
            for (let i = 0; i < periods.events.length; i++) {
                if ("type_id" in periods.events[i]) {
                    if (periods.events[i].type_id === 1) {
                        index = periods.events[i].reason_id !== null ? 4 : 0;
                    } else if (periods.events[i].type_id === 2) {
                        index = 1;
                    } else {
                        let arrayIndex = priority.indexOf(periods.events[i].type_id);
                        index = arrayIndex < index ? arrayIndex : index;
                    }
                } else {
                    index = periods.events[i].reason_id != null ? 4 : 0;
                }
            }
            return className[index] || '';
        };

        vm.reasonSelect = ($event): void => {
            $event.stopPropagation();
        };

        /* filtering by removing multiple choices if there is no reason_id */
        vm.filterSelect = function (options: Reason[], event): Reason[] {
            let reasonIds = EventsUtils.getReasonIds(event.events);
            if (reasonIds.every((val: number, i: number, arr: number[]) => val === arr[0])) {
                return options.filter(option => option.id !== 0);
            }
            return options;
        };

        vm.downloadFile = ($event): void => {
            $event.stopPropagation();
            console.log("downloading File");
        };

        vm.doAction = ($event, event, eventParent?): void => {
            $event.stopPropagation();
            vm.lightbox.action = true;
            vm.event = eventParent ? eventParent : event;
            vm.actionForm.owner = model.me.userId;
            if ('id' in event) {
                vm.actionForm.eventId = [event.id];
            } else {
                /* global action case */
                vm.actionForm.eventId = [event.type.id];
                event.events.forEach(event => {
                    if (vm.actionForm.eventId.indexOf(event.id) === -1) vm.actionForm.eventId.push(event.id)
                });
            }
            vm.actionForm.actionId = null;
            vm.actionForm.comment = "";
            getEventActions();
        };

        vm.switchAbsencesFilter = function () {
            vm.formFilter.absences = !vm.formFilter.absences;
            if (vm.formFilter.absences) {
                if (!vm.eventType.some(e => e == EventType.ABSENCE)) {
                    vm.eventType.push(EventType.ABSENCE);
                }
            } else {
                vm.eventType = _.without(vm.eventType, EventType.ABSENCE);
                vm.formFilter.unjustified = false;
                vm.formFilter.justifiedNotRegularized = false;
                vm.formFilter.justifiedRegularized = false;
            }
            vm.adaptReason();
        };

        vm.showHistory = function () {
            vm.action.seeAll = !vm.action.seeAll;
        };

        vm.stopAbsencePropagation = ($event): void => {
            $event.stopPropagation();
        };

        vm.regularizedChecked = (event: EventResponse): boolean => {
            let regularized = [];
            event.events.forEach((elem) => {
                regularized.push(elem.reason_id && elem.counsellor_regularisation &&
                    (elem.type === EventsUtils.ALL_EVENTS.absence || elem.type_id === 1));
                if ('events' in elem && elem.events.length > 0) {
                    elem.events.forEach(itemEvent => {
                        regularized.push(itemEvent.counsellor_regularisation);
                    });
                }
            });
            return !event.globalCounsellorRegularisation && regularized.filter((r) => r === true).length > 0;
        };

        /* Add global reason_id to all events that exist */
        vm.changeAllReason = async (event: EventResponse): Promise<void> => {
            let initialReasonId = event.globalReason;
            let fetchedEventIds: number[] = [];
            if (isWidget) {
                fetchedEventIds.push(event.id);
            } else {
                EventsUtils.fetchEvents(event, fetchedEventIds);
            }
            await vm.events.updateReason(fetchedEventIds, initialReasonId)
                .then(() => {
                    if (isWidget) vm.events.page = 0;
                    getEvents(true);
                    if (vm.filter.justifiedRegularized) {
                        vm.eventId = null;
                    }
                });
            $scope.safeApply();
        };

        /* Change its description reason id */
        vm.changeReason = async (history: Event, event: EventResponse): Promise<void> => {
            let initialReasonId = history.reason ? history.reason.id : history.reason_id;
            let fetchedEventIds: number[] = [];
            history.counsellor_regularisation = vm.provingReasonsMap[history.reason_id];
            fetchedEventIds.push(history.id);
            event.globalReason = EventsUtils.initGlobalReason(event);
            await vm.events.updateReason(fetchedEventIds, initialReasonId)
                .then(() => {
                    if (EventsUtils.isEachEventsCounsellorRegularized(event.events) &&
                        EventsUtils.hasSameEventsReason(event.events)) {
                        if (!vm.filter.justifiedRegularized) {
                            getEvents(true);
                            vm.eventId = null;
                        }
                    }
                });
            $scope.safeApply();
        };

        vm.toggleAllEventsRegularised = async (event: EventResponse): Promise<void> => {
            let initialCounsellorRegularisation = event.globalCounsellorRegularisation;
            let fetchedEventIds: number[] = [];
            EventsUtils.fetchEvents(event, fetchedEventIds);
            await vm.events.updateRegularized(fetchedEventIds, initialCounsellorRegularisation)
                .then(() => {
                    getEvents(true);
                    vm.eventId = null;
                });
            $scope.safeApply();
        };

        vm.toggleEventRegularised = async (history: Event, event: EventResponse): Promise<void> => {
            let initialCounsellorRegularisation = history.counsellor_regularisation;
            let fetchedEventIds: number[] = [];
            if (history.type === EventsUtils.ALL_EVENTS.event) {
                fetchedEventIds.push(history.id);
            }
            event.globalCounsellorRegularisation = EventsUtils.initGlobalCounsellor(event);
            await vm.events.updateRegularized(fetchedEventIds, initialCounsellorRegularisation)
                .then(() => {
                    if (!isWidget) {
                        if (EventsUtils.hasSameEventsCounsellor(event.events)) {
                            getEvents(true);
                            if (!vm.filter.justifiedRegularized) {
                                vm.eventId = null;
                            }
                        }
                    } else {
                        getEvents(true);
                        $scope.safeApply();
                    }
                });
            $scope.safeApply();
        };

        /* Toggle Collapse */
        vm.toggleCollapse = (event): void => {
            if (vm.eventId == event.currentTarget.getAttribute("data-id")) {
                vm.collapse = !vm.collapse;
                if (vm.collapse) {
                    vm.eventId = event.currentTarget.getAttribute("data-id");
                } else {
                    vm.eventId = null;
                }
            } else {
                vm.collapse = true;
                vm.eventId = event.currentTarget.getAttribute("data-id");
            }
            $scope.safeApply();
        };

        /* Open the concerned event */
        vm.isCollapsibleOpen = ($index): boolean => {
            return $index == vm.eventId
        };

        /* ----------------------------
          Student methods
        ---------------------------- */
        vm.searchByStudent = async (searchText: string) => {
            await vm.students.search(window.structure.id, searchText);
            $scope.safeApply();
        };

        vm.selectStudent = function (model: Student, option: Student) {
            vm.updateFilter(option);
            vm.studentSearchInput = '';
        };

        vm.selectStudentFromDashboard = function (model: Student, option: Student) {
            vm.filter.students = [];
            vm.selectStudent(model, option);
        };

        vm.excludeStudentFromFilter = (student) => {
            vm.filter.students = _.without(vm.filter.students, _.findWhere(vm.filter.students, student));
            vm.updateFilter();
        };

        /* ----------------------------
            Student lightbox methods
        ---------------------------- */

        vm.searchByStudentFromLightbox = async (searchText: string) => {
            await vm.studentsLightbox.search(window.structure.id, searchText);
            $scope.safeApply();
        };

        vm.selectStudentFromLightbox = function (value: string, student: Student) {
            if (!_.find(vm.formFilter.students, student)) {
                vm.formFilter.students.push(student);
            }
            vm.studentSearchInputLightbox = '';
            vm.studentsLightbox.all = [];
        };

        vm.excludeStudentFromFilterLightbox = (student) => {
            vm.formFilter.students = _.without(vm.formFilter.students, _.findWhere(vm.formFilter.students, student));
        };

        /* ----------------------------
          Classes methods
        ---------------------------- */
        vm.searchByClass = async function (value: string) {
            const structureId = window.structure.id;
            try {
                vm.classesFiltered = await GroupService.search(structureId, value);
                vm.classesFiltered.map((obj) => obj.toString = () => obj.name);
                $scope.safeApply();
            } catch (err) {
                vm.classesFiltered = [];
                throw err;
            }
            return;
        };

        vm.selectClass = (model: Student, option: Student): void => {
            vm.updateFilter(null, option);
            vm.classesSearchInput = '';
        };

        vm.excludeClassFromFilter = (audience) => {
            vm.filter.classes = _.without(vm.filter.classes, _.findWhere(vm.filter.classes, audience));
            vm.updateFilter();
        };

        /* ----------------------------
         Classes lightbox methods
       ---------------------------- */
        vm.searchByClassFromLightbox = async function (value: string) {
            const structureId = window.structure.id;
            try {
                vm.classesFilteredLightbox = await GroupService.search(structureId, value);
                vm.classesFilteredLightbox.map((obj) => obj.toString = () => obj.name);
                $scope.safeApply();
            } catch (err) {
                vm.classesFilteredLightbox = [];
                throw err;
            }
            return;
        };

        vm.selectClassFromLightbox = (value: string, classe: any): void => {
            if (!_.find(vm.formFilter.classes, classe)) {
                vm.formFilter.classes.push(classe);
            }
            vm.classesSearchInputLightbox = '';
            vm.classesFilteredLightbox = [];
        };

        vm.excludeClassFromFilterLightbox = (audience) => {
            vm.formFilter.classes = _.without(vm.formFilter.classes, _.findWhere(vm.formFilter.classes, audience));
        };

        /* ----------------------------
          update filter methods
        ---------------------------- */
        vm.updateFilter = (student?, audience?) => {
            if (audience && !_.find(vm.filter.classes, audience)) {
                vm.filter.classes.push(audience);
            }
            if (student && !_.find(vm.filter.students, student)) {
                vm.filter.students.push(student);
            }

            /* Fetch reason Id */
            vm.eventReasonsId = [];
            vm.eventReasonsType.forEach(r => {
                if (r.isSelected && r.id) {
                    vm.eventReasonsId.push(r.id);
                }
            });

            /* Delete eventReasonId */
            if (vm.filter.unjustified && (!vm.filter.justifiedNotRegularized && !vm.filter.justifiedRegularized) ||
                (!vm.filter.unjustified && !vm.filter.justifiedNotRegularized && !vm.filter.justifiedRegularized)) {
                vm.eventReasonsId = [];
            }

            /* Manage state unjustified */
            vm.filter.noReasons = vm.filter.unjustified;

            /* Manage state regularized */
            vm.filter.regularized = !vm.filter.justifiedRegularized;
            vm.filter.regularizedNotregularized = vm.filter.justifiedRegularized && vm.filter.justifiedNotRegularized;

            /* Manage no filter */
            vm.filter.noFilter = !(vm.filter.unjustified && vm.filter.justifiedNotRegularized && vm.filter.justifiedRegularized);

            vm.events.eventType = vm.eventType.toString();
            vm.events.listReasonIds = vm.eventReasonsId.toString();
            vm.events.noReason = vm.filter.noReasons;
            vm.events.regularized = vm.filter.regularized;
            vm.events.noFilter = vm.filter.noFilter;
            vm.events.regularizedNotregularized = vm.filter.regularizedNotregularized;

            EventsUtils.setStudentToSync(vm.events, vm.filter);
            EventsUtils.setClassToSync(vm.events, vm.filter);
            vm.events.page = 0;
            $scope.safeApply();
        };

        vm.updateDate = async () => {
            if (vm.filter.startDate && vm.filter.endDate) {
                getEvents();
                $scope.safeApply();
            }
        };

        /* ----------------------------
          Export methods
        ---------------------------- */
        vm.exportPdf = function () {
            console.log("exporting Pdf");
        };

        vm.exportCsv = function () {
            console.log("exporting Csv");
        };

        /* ----------------------------
         Switch type methods
        ---------------------------- */

        vm.switchAbsencesFilter = function () {
            vm.formFilter.absences = !vm.formFilter.absences;
            if (vm.formFilter.absences) {
                if (!vm.eventType.some(e => e == EventType.ABSENCE)) {
                    vm.eventType.push(EventType.ABSENCE);
                }
            } else {
                vm.eventType = _.without(vm.eventType, EventType.ABSENCE);
                vm.formFilter.unjustified = false;
                vm.formFilter.justifiedNotRegularized = false;
                vm.formFilter.justifiedRegularized = false;
            }
            vm.adaptReason();
        };

        vm.switchLateFilter = function () {
            vm.formFilter.late = !vm.formFilter.late;
            if (vm.formFilter.late) {
                if (!vm.eventType.some(e => e == EventType.LATENESS)) {
                    vm.eventType.push(EventType.LATENESS);
                }
            } else {
                vm.eventType = _.without(vm.eventType, EventType.LATENESS);
            }
        };

        vm.switchDepartureFilter = function () {
            vm.formFilter.departure = !vm.formFilter.departure;
            if (vm.formFilter.departure) {
                if (!vm.eventType.some(e => e == EventType.DEPARTURE)) {
                    vm.eventType.push(EventType.DEPARTURE);
                }
            } else {
                vm.eventType = _.without(vm.eventType, EventType.DEPARTURE);
            }
        };

        vm.switchUnjustifiedFilter = function () {
            vm.formFilter.unjustified = !vm.formFilter.unjustified;
        };

        vm.switchjustifiedNotRegularizedFilter = function () {
            vm.formFilter.justifiedNotRegularized = !vm.formFilter.justifiedNotRegularized;
        };

        vm.switchjustifiedRegularizedFilter = function () {
            vm.formFilter.justifiedRegularized = !vm.formFilter.justifiedRegularized;
        };

        vm.switchReason = async function (reason: Reason) {
            reason.isSelected = !reason.isSelected;
        };

        vm.switchAllReasons = function () {
            vm.formFilter.allReasons = !vm.formFilter.allReasons;
            vm.formFilter.noReasons = vm.formFilter.allReasons;
            vm.eventReasonsType.forEach(reason => reason.isSelected = vm.formFilter.allReasons);
        };

        vm.adaptEvent = function () {
            if (!vm.formFilter.unjustified && !vm.formFilter.justifiedNotRegularized && !vm.formFilter.justifiedRegularized) {
                vm.switchAbsencesFilter();
            }
        };

        vm.adaptReason = function () {
            if (!vm.formFilter.absences) {
                vm.eventReasonsId = [];
                vm.eventType = _.without(vm.eventType, EventType.ABSENCE);
            } else {
                vm.formFilter.unjustified = true;
                vm.formFilter.justifiedNotRegularized = true;
                vm.formFilter.justifiedRegularized = true;
            }
        };

        vm.hideGlobalCheckbox = function (event) {
            const {events} = event;
            const isProving = (evt) => evt.reason_id === null || vm.provingReasonsMap[evt.reason_id];

            return events.every(isProving);
        };

        /* Form filter */
        vm.openForm = function () {
            vm.lightbox.filter = true;
            vm.formFilter = JSON.parse(JSON.stringify(vm.filter));
        };

        vm.validForm = function () {
            const {startDate, endDate} = vm.filter;
            vm.filter = {...vm.formFilter, startDate, endDate};
            vm.formFilter = {};
            vm.updateFilter();
            vm.lightbox.filter = false;
        };

        /* Form action */
        vm.validActionForm = function () {
            vm.lightbox.action = false;
            vm.createAction();
        };

        /* on  (watch) */
        $scope.$watch(() => window.structure, () => {
            getEvents();
            getActions();
        });

        /* Destroy directive and scope */
        $scope.$on("$destroy", () => {
            /* Remove directive/ghost div that remains on the view before changing route */
            angular.element(document.querySelectorAll(".datepicker")).remove();
            angular.element(document.querySelectorAll(".tooltip")).remove();
        });
    }]);