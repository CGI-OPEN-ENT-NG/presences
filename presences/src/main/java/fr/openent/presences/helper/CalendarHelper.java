package fr.openent.presences.helper;

import fr.openent.presences.common.helper.DateHelper;
import fr.openent.presences.model.Course;
import fr.openent.presences.model.Slot;
import fr.wseduc.webutils.security.Md5;
import io.vertx.core.MultiMap;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.core.logging.Logger;
import io.vertx.core.logging.LoggerFactory;

import java.security.NoSuchAlgorithmException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.util.*;

import static fr.openent.presences.common.helper.DateHelper.*;

public class CalendarHelper {
    private static final Logger LOGGER = LoggerFactory.getLogger(CalendarHelper.class);

    public static HashMap<String, Map<String, Course>> hashCourses(List<Course> courses, List<Slot> slots,
                                                                   List<String> subjects) {
        HashMap<String, Map<String, Course>> courseList = new HashMap<>();
        try {
            for (Course course : courses) {
                if (!subjects.contains(course.getSubjectId()) && course.getExceptionnal().isEmpty()) {
                    subjects.add(course.getSubjectId());
                }
                String hashMainCourse = hash(course.getId() + course.getStartDate() + course.getEndDate());
                SimpleDateFormat parser = new SimpleDateFormat(DateHelper.HOUR_MINUTES_SECONDS);
                Date startTime = parser.parse(DateHelper.getTimeString(course.getStartDate(), DateHelper.MONGO_FORMAT));
                Date endTime = parser.parse(DateHelper.getTimeString(course.getEndDate(), DateHelper.MONGO_FORMAT));
                for (Slot slot : slots) {
                    Date slotStartHour = parser.parse(slot.getStartHour());
                    Date slotEndHour = parser.parse(slot.getEndHour());
                    if (((slotStartHour.after(startTime) || slotStartHour.equals(startTime)) || (startTime.before(slotEndHour)))
                            && ((slotEndHour.before(endTime) || slotEndHour.equals(endTime)) || (endTime.after(slotStartHour)))
                            && !(course.getRegisterId() != null && !course.isSplitSlot())) {
                        Course newCourse = CourseHelper.treatingSplitSlot(course, slot, parser);
                        String hashCourse = hash(newCourse.getId() + newCourse.getStartDate() + newCourse.getEndDate());
                        Map<String, Course> mainCourse = new LinkedHashMap<>();
                        mainCourse.put(hashMainCourse, course);
                        courseList.put(hashCourse, mainCourse);
                    } else {
                        Map<String, Course> mainCourse = new LinkedHashMap<>();
                        mainCourse.put(hashMainCourse, course);
                        courseList.put(hashMainCourse, mainCourse);
                    }
                }
            }
        } catch (ParseException e) {
            LOGGER.error("[Presences@CalendarHelper] Failed to parse date [see DateHelper/CourseHelper]", e);
            new HashMap<>();
        }
        return courseList;
    }

    public static String hash(String value) {
        String hash = "";
        try {
            hash = Md5.hash(value);
        } catch (NoSuchAlgorithmException e) {
            LOGGER.error("[CalendarController@hash] Failed to hash " + value, e);
        }
        return hash;
    }

    public static boolean calendarMatchDate(JsonObject events, String startDate, String endDate) {
        try {
            return DateHelper.isBetween(
                    events.getString("start_date"),
                    events.getString("end_date"),
                    startDate + "T00:00:00.000",
                    endDate + "T00:00:00.000"
            );
        } catch (ParseException e) {
            LOGGER.error("[CalendarController@calendarMatchDate] Failed to parse date", e);
            return false;
        }
    }

    public static JsonArray addAbsencesCourses(JsonObject absent, MultiMap params) {
        try {
            String startDateTime = DateHelper.getTimeString(absent.getString("start_date"), SQL_FORMAT);
            String endDateTime = DateHelper.getTimeString(absent.getString("end_date"), SQL_FORMAT);

            JsonArray coursesAdded = new JsonArray();

            List<LocalDate> totalDates = DateHelper.getDatesBetweenTwoDates(params.get("start"), params.get("end"));

            LocalDate absentsStart = LocalDate.parse(DateHelper.getDateString(absent.getString("start_date"), YEAR_MONTH_DAY));
            LocalDate absentsEnd = LocalDate.parse(DateHelper.getDateString(absent.getString("end_date"), YEAR_MONTH_DAY));
            for (LocalDate totalDate : totalDates) {
                if ((totalDate.isAfter(absentsStart) || totalDate.isEqual(absentsStart)) && (totalDate.isBefore(absentsEnd) || totalDate.isEqual(absentsEnd))) {
                    String startDate = totalDate.isEqual(absentsStart) ? totalDate.toString() : totalDate.toString();
                    String startTime = (totalDate.isEqual(absentsStart) ? startDateTime : "00:00");
                    String endDate = (totalDate.isEqual(absentsEnd) ? totalDate.toString() : totalDate.toString());
                    String endTime = (totalDate.isEqual(absentsEnd) ? endDateTime : "23:59");

                    coursesAdded.add(new JsonObject()
                            .put("_id", "0")
                            .put("dayOfWeek", DateHelper.getDayOfWeek(DateHelper.parse(totalDate.toString(), YEAR_MONTH_DAY)))
                            .put("is_periodic", false)
                            .put("absence", true)
                            .put("locked", true)
                            .put("absenceId", absent.getLong("id"))
                            .put("absenceReason", absent.getInteger("reason_id") != null ? absent.getInteger("reason_id") : 0)
                            .put("structureId", params.get("structure"))
                            .put("events", new JsonArray())
                            .put("startDate", startDate + " " + startTime)
                            .put("startMomentDate", startDate + " " + startTime)
                            .put("startMomentTime", startTime)
                            .put("endDate", endDate + " " + endTime)
                            .put("endMomentDate", endDate + " " + endTime)
                            .put("endMomentTime", startTime)
                    );
                }
            }
            return coursesAdded;
        } catch (ParseException e) {
            LOGGER.error("[CalendarController@absent] Failed to parse date", e);
            return new JsonArray();
        }
    }

    public static JsonObject incident(Course course, JsonArray incidents) {
        for (int j = 0; j < incidents.size(); j++) {
            JsonObject incident = incidents.getJsonObject(j);
            try {
                if (DateHelper.isBeforeOrEquals(course.getStartDate(), incident.getString("date"))
                        && DateHelper.isAfterOrEquals(course.getEndDate(), incident.getString("date"))) {
                    return incident;
                }
            } catch (ParseException e) {
                LOGGER.error("[CalendarController@incident] Failed to parse date", e);
            }
        }

        return null;
    }

    public static JsonObject exempted(Course course, JsonArray exemptions) {
        String courseStartDate = DateHelper.getDateString(course.getStartDate(), YEAR_MONTH_DAY);
        String courseEndDate = DateHelper.getDateString(course.getEndDate(), YEAR_MONTH_DAY);
        SimpleDateFormat sdf = new SimpleDateFormat(YEAR_MONTH_DAY);

        try {
            Date dateCourseStartDate = sdf.parse(courseStartDate);
            Date dateCourseEndDate = sdf.parse(courseEndDate);

            for (int i = 0; i < exemptions.size(); i++) {
                JsonObject exemption = exemptions.getJsonObject(i);

                Date exemptionStartDate = sdf.parse(DateHelper.getDateString(exemption.getString("start_date"), YEAR_MONTH_DAY));
                Date exemptionEndDate = sdf.parse(DateHelper.getDateString(exemption.getString("end_date"), YEAR_MONTH_DAY));

                if ((dateCourseStartDate.after(exemptionStartDate) || dateCourseStartDate.equals(exemptionStartDate)) &&
                        (dateCourseEndDate.before(exemptionEndDate) || dateCourseEndDate.equals(exemptionEndDate))) {
                    return exemption;
                }

            }
        } catch (ParseException e) {
            LOGGER.error("[CalendarController@exempted] Failed to parse date", e);
        }

        return null;
    }

    public static void formatCourse(Course course) {
        course.setColor("");
        course.setStartCourse("");
        course.setEndCourse("");
        course.setTeachers(new JsonArray());
        course.setManual(null);
        course.setLocked(true);
        course.setStartMomentDate(DateHelper.getDateString(course.getStartDate(), DAY_MONTH_YEAR));
        course.setStartMomentTime(DateHelper.getDateString(course.getStartDate(), DateHelper.HOUR_MINUTES));
        course.setEndMomentDate(DateHelper.getDateString(course.getEndDate(), DAY_MONTH_YEAR));
        course.setEndMomentTime(DateHelper.getDateString(course.getEndDate(), DateHelper.HOUR_MINUTES));
    }

    public static List<String> getGroupsName(JsonArray groups) {
        List<String> names = new ArrayList<>();
        for (int i = 0; i < groups.size(); i++) {
            JsonObject group = groups.getJsonObject(i);
            if (group.containsKey("name")) names.add(group.getString("name"));
        }

        return names;
    }
}
