import {SNIPLET_FORM_EMIT_EVENTS, SNIPLET_FORM_EVENTS} from "@common/model";
import {Absence} from "../models";
import {idiom as lang, model, moment, toasts} from "entcore";
import {reasonService} from "../services";
import {IAngularEvent} from "angular";
import {DateUtils} from "@common/utils";
import {Reason} from "@presences/models/Reason";
import {ABSENCE_FORM_EVENTS} from "@common/enum/presences-event";
import {EventsUtils} from "../utilities";
import {AxiosResponse} from "axios";

console.log("absenceFormSnipplets");

declare let window: any;

interface ViewModel {
    createAbsenceLightBox: boolean;
    isEventEditable: boolean;

    form: any;
    reasonsType: any;

    openAbsenceLightbox(event: IAngularEvent, args: any): void;

    setFormParams(obj): void;

    setFormDateParams(form, start_date, end_date): void;

    filterSelect(reasons: Reason[]): Reason[];

    editAbsenceForm(obj): void;

    editEventAbsenceForm(obj): void;

    isFormValid(): boolean;

    canDeleteEvent(): boolean;

    createAbsence(): Promise<void>;

    updateAbsence(): Promise<void>;

    deleteAbsence(): Promise<void>;

    closeAbsenceLightbox(): void;

    safeApply(fn?: () => void): void;
}

const vm: ViewModel = {
    safeApply: null,
    createAbsenceLightBox: false,
    reasonsType: null,
    form: Absence,
    isEventEditable: true,

    openAbsenceLightbox(event: IAngularEvent, args: any): void {
        vm.createAbsenceLightBox = true;
        vm.form = new Absence(null, null, null, null);
        absenceForm.that.$emit(SNIPLET_FORM_EMIT_EVENTS.CREATION);
        if (event) {
            vm.form.startDate = args.startDate;
            vm.form.endDate = args.endDate;
            vm.form.startDateTime = args.startTime;
            vm.form.endDateTime = args.endTime;
        }
        vm.safeApply();
    },

    setFormParams: ({student, start_date, end_date}) => {
        if (vm.form) {
            vm.form.student_id = student.id;
            vm.setFormDateParams(vm.form, start_date, end_date);
            vm.safeApply();
        }
    },

    setFormDateParams: (form, start_date, end_date) => {
        form.startDate = moment(start_date).toDate();
        form.endDate = moment(end_date).toDate();
        if (form.id) {
            form.startDateTime = moment(form.startDate).set({second: 0, millisecond: 0}).toDate();
            form.endDateTime = moment(form.endDate).set({second: 0, millisecond: 0}).toDate();
            return;
        } else {
            form.startDateTime = moment(new Date()).set({second: 0, millisecond: 0}).toDate();
        }
        form.endDateTime = moment(new Date().setHours(17)).set({minute: 0, second: 0, millisecond: 0}).toDate();
        form.start_date = DateUtils.getDateFormat(form.startDate, form.startDateTime);
        form.end_date = DateUtils.getDateFormat(form.endDate, form.endDateTime);
    },

    filterSelect(reasons: Reason[]): Reason[] {
        if (reasons && reasons.length > 0) {
            return reasons.filter(option => option.id !== 0);
        }
        return [];
    },

    async editAbsenceForm(obj): Promise<void> {
        vm.createAbsenceLightBox = true;
        vm.form = new Absence(null, null, null, null);
        let response = await vm.form.getAbsence(obj.absenceId);
        if (response.status == 200 || response.status == 201) {
            /* Assign response data to form edited */
            vm.form.absences = [response.data];
            vm.form.absences.map(absence => absence.type = EventsUtils.ALL_EVENTS.absence);
            vm.form.id = response.data.id;
            vm.form.start_date = response.data.start_date;
            vm.form.end_date = response.data.end_date;
            vm.form.student_id = response.data.student_id;
            vm.form.reason_id = response.data.reason_id;
            vm.setFormDateParams(vm.form, vm.form.start_date, vm.form.end_date);
        } else {
            toasts.warning(response.data.toString());
        }
        vm.safeApply();
    },

    editEventAbsenceForm(data): void {
        vm.createAbsenceLightBox = true;
        vm.form = new Absence(null, null, null, null);
        vm.form.absences = data.absences;
        vm.form.id = 1;
        vm.form.start_date = data.startDate;
        vm.form.end_date = data.endDate;
        vm.form.student_id = data.studentId;
        vm.form.reason_id = data.reason_id ? data.reason_id : vm.form.absences
            .find(a => 'type' in a || 'type_id' in a).reason_id;
        vm.form.type = data.eventType;
        vm.setFormDateParams(vm.form, vm.form.start_date, vm.form.end_date);
        vm.safeApply();
    },

    isFormValid(): boolean {
        if (vm.form) {
            return DateUtils.getDateFormat(vm.form.startDate, vm.form.startDateTime) <= DateUtils.getDateFormat(vm.form.endDate, vm.form.startDateTime);
        }
        return false;
    },

    canDeleteEvent(): boolean {
        if (vm.form.absences.length < 0) return true;
        for (const absence of vm.form.absences) {
            if (('type' in absence && absence.type === EventsUtils.ALL_EVENTS.absence)
                || ('counsellor_input' in absence && absence.counsellor_input)) {
                return false;
            }
        }
        return true;
    },

    async createAbsence(): Promise<void> {
        vm.form.start_date = DateUtils.getDateFormat(vm.form.startDate, vm.form.startDateTime);
        vm.form.end_date = DateUtils.getDateFormat(vm.form.endDate, vm.form.endDateTime);
        let response = await vm.form.createAbsence(window.structure.id, vm.form.reason_id, model.me.userId);
        if (response.status == 200 || response.status == 201) {
            vm.closeAbsenceLightbox();
            toasts.confirm(lang.translate('presences.absence.form.create.succeed'));
        } else {
            toasts.warning(response.data.toString());
        }
        absenceForm.that.$emit(SNIPLET_FORM_EMIT_EVENTS.FILTER);
        vm.safeApply();
    },

    async updateAbsence(): Promise<void> {
        vm.form.start_date = DateUtils.getDateFormat(vm.form.startDate, vm.form.startDateTime);
        vm.form.end_date = DateUtils.getDateFormat(vm.form.endDate, vm.form.endDateTime);
        let response: AxiosResponse;
        let responses: AxiosResponse[] = [];
        if (vm.form.type === EventsUtils.ALL_EVENTS.event && !vm.form.absences.find(a => 'type' in a)) {
            responses = [await vm.form.createAbsence(window.structure.id, vm.form.reason_id, model.me.userId)];
        } else {
            for (const absence of vm.form.absences) {
                responses.push(await vm.form.updateAbsence(absence.id, window.structure.id, vm.form.reason_id, model.me.userId));
            }
        }
        let failedResponse = responses.find((response) => response.status != 200 && response.status != 201);

        if (failedResponse) {
            toasts.warning(response.data.toString());
        } else {
            vm.closeAbsenceLightbox();
            toasts.confirm(lang.translate('presences.absence.form.edit.succeed'));
        }
        absenceForm.that.$emit(SNIPLET_FORM_EMIT_EVENTS.EDIT);
        vm.safeApply();
    },

    async deleteAbsence(): Promise<void> {
        let responses = [];

        for (const absence of vm.form.absences) {
            if ('type' in absence && absence.type === EventsUtils.ALL_EVENTS.absence) {
                responses.push(await vm.form.deleteAbsence(absence.id));
            } else {
                responses.push(await vm.form.deleteEventAbsence(absence.id));
            }
        }

        let failedResponse = responses.find((response) => response.status != 200 && response.status != 201);
        if (failedResponse) {
            toasts.warning(failedResponse.data.toString());
        } else {
            vm.closeAbsenceLightbox();
            toasts.confirm(lang.translate('presences.absence.form.delete.succeed'));
        }
        absenceForm.that.$emit(SNIPLET_FORM_EMIT_EVENTS.DELETE);
        vm.safeApply();
    },

    closeAbsenceLightbox(): void {
        vm.createAbsenceLightBox = false;
        absenceForm.that.$emit(SNIPLET_FORM_EMIT_EVENTS.CANCEL);
    }
};

export const absenceForm = {
    title: 'presences.register.event_type.absences',
    public: false,
    that: null,
    controller: {
        init: async function () {
            this.vm = vm;
            this.setHandler();
            absenceForm.that = this;
            vm.reasonsType = await reasonService.getReasons(window.structure.id);
            vm.safeApply = this.safeApply;
        },
        setHandler: function () {
            this.$on(ABSENCE_FORM_EVENTS.EDIT, (event: IAngularEvent, args) => vm.editAbsenceForm(args));
            this.$on(ABSENCE_FORM_EVENTS.EDIT_EVENT, (event: IAngularEvent, args) => vm.editEventAbsenceForm(args));
            this.$on(ABSENCE_FORM_EVENTS.OPEN, (event: IAngularEvent, args) => vm.openAbsenceLightbox(event, args));
            this.$on(SNIPLET_FORM_EVENTS.SET_PARAMS, (event: IAngularEvent, arg) => vm.setFormParams(arg));
        }
    }
};