import {idiom as lang, model, moment, ng} from 'entcore';
import {IPDetentionField, IPunishment, IPunishmentBody, ITimeSlot, TimeSlotHourPeriod} from "@incidents/models";
import {DateUtils} from "@common/utils";

interface IViewModel {
    form: IPunishmentBody;
    punishment: IPunishment;
    timeSlots: Array<ITimeSlot>;
    owner: string;
    date: { date: string, start_time: Date, end_time: Date, isFree: boolean };
    timeSlotTimePeriod?: {
        start: ITimeSlot;
        end: ITimeSlot;
    };
    timeSlotHourPeriod: typeof TimeSlotHourPeriod;
    selectTimeSlotText: string;

    selectTimeSlot(hourPeriod: TimeSlotHourPeriod): void;

    changeTimeInput(): void;
}

export const PunishmentDetentionForm = ng.directive('punishmentDetentionForm', () => {
    return {
        restrict: 'E',
        transclude: true,
        scope: {
            form: '=',
            timeSlots: '=',
            punishment: '='
        },
        template: `
          <div class="punishment-detention-form">
             <!-- Date -->
             <div class="punishment-detention-form-date">
                <!-- Date -->
                <div>
                    <i18n>incidents.date</i18n> &#58;&nbsp;
                    <span class="card date-picker">
                        <date-picker required ng-model="vm.date.date"></date-picker>
                    </span>
                </div>
                
                 <!-- CASE FALSE : Select time slots -->
                <div data-ng-show="!vm.date.isFree" class="timeslot">
                    <!-- start time slot -->
                    <i18n>presences.by</i18n>&#58;
                    <label class="timeslot-select">
                        <i class="time-picker"></i>
                        <select data-ng-model="vm.timeSlotTimePeriod.start"
                                data-ng-change="vm.selectTimeSlot(vm.timeSlotHourPeriod.START_HOUR)"
                                ng-options="item.name + ' : ' + item.startHour for item in vm.timeSlots
                                | orderBy:vm.timeSlotHourPeriod.START_HOUR">
                            <option value="">[[vm.selectTimeSlotText]]</option>
                        </select>
                    </label>

                    <!-- end time slot -->
                    <i18n>presences.at</i18n>&#58;
                    <label class="timeslot-select">
                        <i class="time-picker"></i>
                        <select data-ng-model="vm.timeSlotTimePeriod.end"
                                data-ng-change="vm.selectTimeSlot(vm.timeSlotHourPeriod.END_HOUR)"
                                ng-options="item.name + ' : ' + item.endHour for item in vm.timeSlots
                                | orderBy:vm.timeSlotHourPeriod.END_HOUR">
                            <option value="">[[vm.selectTimeSlotText]]</option>
                        </select>
                    </label>
                </div>
                
                <!-- CASE TRUE : Free choice for time slots -->
                  <div data-ng-show="vm.date.isFree">
                    <!-- start time -->
                    <span class="presenceLightbox-body-info-time-start">
                        <i18n>presences.by</i18n> &#58;
                        <span class="card card-timepicker">
                            <time-picker required ng-model="vm.date.start_time" data-ng-change="vm.changeTimeInput()"></time-picker>
                        </span>
                    </span>
    
                    <!-- end time -->
                    <span class="presenceLightbox-body-info-time-end">
                        <i18n>presences.at</i18n> &#58;
                        <span class="card card-timepicker">
                            <time-picker required ng-model="vm.date.end_time" data-ng-change="vm.changeTimeInput()"></time-picker>
                        </span>
                    </span>
                </div>
               <div data-ng-show="vm.date.isFree">&nbsp;</div>
                
             </div>
             
           <!-- checkbox free timeslot -->
           <label class="checkbox">
                <input type="checkbox" data-ng-model="vm.date.isFree"/>
                <span></span>
            </label>&nbsp;
            <i18n>incidents.choice.time.slot</i18n>
           
            <!-- place -->
            <div class="punishment-detention-form-place">
                <i18n>incidents.place</i18n>&#58;&nbsp;
                <input i18n-placeholder="incidents.write.text" data-ng-model="vm.form.fields.place">
            </div>
            
            <!-- responsible -->
            <div>
                 <i18n>presences.responsible</i18n>&nbsp;
                 <span class="font-bold">[[vm.owner]]</span>
            </div>
        </div>
        `,
        controllerAs: 'vm',
        bindToController: true,
        replace: true,
        controller: function () {
            const vm: IViewModel = <IViewModel>this;
            vm.timeSlotHourPeriod = TimeSlotHourPeriod;
            vm.selectTimeSlotText = lang.translate('presences.pick.timeslot');

            const setTimeSlot = () => {
                let start = DateUtils.format((<IPDetentionField>vm.form.fields).start_at, DateUtils.FORMAT["HOUR-MINUTES"]);
                let end = DateUtils.format((<IPDetentionField>vm.form.fields).end_at, DateUtils.FORMAT["HOUR-MINUTES"]);
                vm.timeSlotTimePeriod = {
                    start: {endHour: "", id: "", name: "", startHour: ""},
                    end: {endHour: "", id: "", name: "", startHour: ""}
                };
                vm.timeSlots.forEach((slot: ITimeSlot) => {
                    if (slot.startHour === start) {
                        vm.timeSlotTimePeriod.start = slot;
                    }
                    if (slot.endHour === end) {
                        vm.timeSlotTimePeriod.end = slot;
                    }
                });
                if (vm.timeSlotTimePeriod.start.startHour !== "" && vm.timeSlotTimePeriod.end.endHour !== "") {
                    vm.date.isFree = false;
                }
            };

            // if edit mode
            if (!vm.punishment.id) {
                vm.form.owner_id = model.me.userId;
                vm.date = {
                    date: moment(),
                    start_time: moment().set({second: 0, millisecond: 0}).toDate(),
                    end_time: moment().add(1, 'h').set({second: 0, millisecond: 0}).toDate(),
                    isFree: false
                };
                vm.timeSlotTimePeriod = {
                    start: null,
                    end: null
                };
                vm.form.fields = {
                    start_date: DateUtils.format(vm.date.date, DateUtils.FORMAT["YEAR-MONTH-DAY-HOUR-MIN-SEC"]),
                    end_date: DateUtils.format(vm.date.date, DateUtils.FORMAT["YEAR-MONTH-DAY-HOUR-MIN-SEC"]),
                    place: ""
                } as IPDetentionField;
                vm.owner = model.me.username;
            } else {
                // create mode
                vm.form.owner_id = vm.punishment.owner.id;
                vm.form.fields = vm.punishment.fields;

                // on switch category (in case we reset)
                if (!(Object.keys(vm.form.fields).length > 0)) {
                    vm.form.fields = {
                        start_date: DateUtils.format(vm.date.date, DateUtils.FORMAT["YEAR-MONTH-DAY-HOUR-MIN-SEC"]),
                        end_date: DateUtils.format(vm.date.date, DateUtils.FORMAT["YEAR-MONTH-DAY-HOUR-MIN-SEC"]),
                        place: ""
                    } as IPDetentionField;
                    vm.date.isFree = false;
                    vm.timeSlotTimePeriod = {
                        start: null,
                        end: null
                    };
                }

                vm.date = {
                    date: moment((<IPDetentionField>vm.form.fields).start_at),
                    start_time: moment((<IPDetentionField>vm.form.fields).start_at).set({
                        second: 0,
                        millisecond: 0
                    }).toDate(),
                    end_time: moment((<IPDetentionField>vm.form.fields).end_at).set({
                        second: 0,
                        millisecond: 0
                    }).toDate(),
                    isFree: true
                };
                setTimeSlot();
                vm.owner = vm.punishment.owner.displayName;
            }
        },
        link: function ($scope, $element: HTMLDivElement) {
            const vm: IViewModel = $scope.vm;

            vm.selectTimeSlot = (hourPeriod: TimeSlotHourPeriod): void => {
                switch (hourPeriod) {
                    case TimeSlotHourPeriod.START_HOUR:
                        let start = vm.timeSlotTimePeriod.start != null ? DateUtils.getDateFormat(new Date(vm.date.date),
                            DateUtils.getTimeFormatDate(vm.timeSlotTimePeriod.start.startHour)) : null;

                        (<IPDetentionField>vm.form.fields).start_at = start;
                        (<IPDetentionField>vm.form.fields).end_at = vm.timeSlotTimePeriod.end != null ? DateUtils.getDateFormat(new Date(vm.date.date),
                            DateUtils.getTimeFormatDate(vm.timeSlotTimePeriod.end.endHour)) : moment(new Date(vm.date.date));

                        console.log("VMDetention: ", vm.form);
                        break;
                    case TimeSlotHourPeriod.END_HOUR:
                        let end = vm.timeSlotTimePeriod.end != null ? DateUtils.getDateFormat(new Date(vm.date.date),
                            DateUtils.getTimeFormatDate(vm.timeSlotTimePeriod.end.endHour)) : null;
                        (<IPDetentionField>vm.form.fields).end_at = end;
                        (<IPDetentionField>vm.form.fields).start_at = vm.timeSlotTimePeriod.start != null ? DateUtils.getDateFormat(new Date(vm.date.date),
                            DateUtils.getTimeFormatDate(vm.timeSlotTimePeriod.start.startHour)) : moment(new Date(vm.date.date));
                        console.log("VMDetention: ", vm.form);
                        break;
                    default:
                        return;
                }
            };

            vm.changeTimeInput = (): void => {
                (<IPDetentionField>vm.form.fields).start_at = DateUtils.getDateFormat(moment(vm.date.date), vm.date.start_time);
                (<IPDetentionField>vm.form.fields).end_at = DateUtils.getDateFormat(moment(vm.date.date), vm.date.end_time);
                console.log("VMDetention: ", vm.form);
            };
        }
    };
});