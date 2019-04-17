import {moment} from 'entcore';
import {Course} from '../models'
import {Moment} from "moment";

export class CourseUtils {
    /**
     * Return if given course is current course
     * @param course Course to test
     */
    static isCurrentCourse(course: Course): boolean {
        const now: Moment = moment();
        const start: Moment = moment(course.startDate);
        const end: Moment = moment(course.endDate);
        return start.diff(now) < 0 && end.diff(now) > 0;
    }
}