package fr.openent.presences.controller;

import fr.openent.presences.constants.Actions;
import fr.openent.presences.security.AbsenceWidgetRight;
import fr.openent.presences.security.CreateEventRight;
import fr.openent.presences.security.Manage;
import fr.openent.presences.service.AbsenceService;
import fr.openent.presences.service.impl.DefaultAbsenceService;
import fr.wseduc.rs.*;
import fr.wseduc.security.ActionType;
import fr.wseduc.security.SecuredAction;
import fr.wseduc.webutils.request.RequestUtils;
import io.vertx.core.eventbus.EventBus;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.json.JsonObject;
import org.entcore.common.controller.ControllerHelper;
import org.entcore.common.http.filter.ResourceFilter;
import org.entcore.common.http.filter.Trace;
import org.entcore.common.http.response.DefaultResponseHandler;
import org.entcore.common.user.UserUtils;

import java.util.ArrayList;
import java.util.List;

public class AbsenceController extends ControllerHelper {

    private EventBus eb;
    private AbsenceService absenceService;

    public AbsenceController(EventBus eb) {
        super();
        this.eb = eb;
        this.absenceService = new DefaultAbsenceService(eb);

    }

    @Get("/absence/:id")
    @ApiDoc("Delete absence")
    @ResourceFilter(Manage.class)
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    public void getAbsenceId(final HttpServerRequest request) {
        if (!request.params().contains("id")) {
            badRequest(request);
            return;
        }
        Integer absenceId = Integer.parseInt(request.getParam("id"));
        absenceService.getAbsenceId(absenceId, DefaultResponseHandler.defaultResponseHandler(request));
    }

    @Post("/absence")
    @ApiDoc("Create absence")
    @ResourceFilter(CreateEventRight.class)
    @Trace(Actions.ABSENCE_CREATION)
    public void postEvent(HttpServerRequest request) {
        RequestUtils.bodyToJson(request, event -> {
            if (!isAbsenceBodyValid(event)) {
                badRequest(request);
                return;
            }

            UserUtils.getUserInfos(eb, request, user -> absenceService.create(event, user, true, either -> {
                if (either.isLeft()) {
                    log.error("[Presences@AbsenceController] failed to create absent or events", either.left().getValue());
                    renderError(request);
                } else {
                    JsonObject res = new JsonObject().put("events", either.right().getValue());
                    renderJson(request, res, 201);
                }
            }));
        });
    }

    @Put("/absence/:id")
    @ApiDoc("Update absence")
    // TODO Change this right
    @ResourceFilter(Manage.class)
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @Trace(Actions.ABSENCE_UPDATE)
    public void update(final HttpServerRequest request) {
        if (!request.params().contains("id")) {
            badRequest(request);
            return;
        }
        Long absenceId = Long.parseLong(request.getParam("id"));
        RequestUtils.bodyToJson(request, absence -> {
            if (!isAbsenceBodyValid(absence)) {
                badRequest(request);
                return;
            }
            UserUtils.getUserInfos(eb, request, user -> absenceService.update(absenceId, absence, user, true, either -> {
                if (either.isLeft()) {
                    log.error("[Presences@AbsenceController] failed to update absence", either.left().getValue());
                    renderError(request);
                } else {
                    renderJson(request, either.right().getValue());
                }
            }));
        });
    }

    @Put("/absence/reason")
    @ApiDoc("Update reason in absence")
    @ResourceFilter(Manage.class)
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @Trace(Actions.ABSENCE_UPDATE_SET_REASON)
    public void changeReasonAbsence(HttpServerRequest request) {
        RequestUtils.bodyToJson(request, absence -> {
            absenceService.changeReasonAbsences(absence, DefaultResponseHandler.defaultResponseHandler(request));
        });
    }

    @Put("/absence/regularized")
    @ApiDoc("Update regularized absence")
    @ResourceFilter(Manage.class)
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @Trace(Actions.ABSENCE_REGULARISATION)
    public void regularizedAbsences(HttpServerRequest request) {
        RequestUtils.bodyToJson(request, absence -> {
            absenceService.changeRegularizedAbsences(absence, DefaultResponseHandler.defaultResponseHandler(request));
        });
    }


    private Boolean isAbsenceBodyValid(JsonObject absence) {
        return absence.containsKey("start_date") && absence.containsKey("end_date") && absence.containsKey("student_id");
    }

    @Delete("/absence/:id")
    @ApiDoc("Delete absence")
    @ResourceFilter(Manage.class)
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @Trace(Actions.ABSENCE_DELETION)
    public void delete(final HttpServerRequest request) {
        if (!request.params().contains("id")) {
            badRequest(request);
            return;
        }
        Integer absenceId = Integer.parseInt(request.getParam("id"));
        absenceService.delete(absenceId, DefaultResponseHandler.defaultResponseHandler(request));
    }

    @Get("/absences")
    @ApiDoc("Retrieve all absences matching parameters")
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @ResourceFilter(AbsenceWidgetRight.class)
    public void getAbsences(HttpServerRequest request) {
        String stucture = request.getParam("structure");
        String start = request.getParam("start");
        String end = request.getParam("end");
        List<String> students = request.params().getAll("student");
        Boolean justified = request.params().contains("justified") ? Boolean.parseBoolean(request.getParam("justified")) : null;
        Boolean regularized = request.params().contains("regularized") ? Boolean.parseBoolean(request.getParam("regularized")) : null;
        List<Integer> reasons = request.params().getAll("reason")
                .stream()
                .mapToInt(Integer::parseInt)
                .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);

        absenceService.retrieve(stucture, students, start, end, justified, regularized, reasons, DefaultResponseHandler.arrayResponseHandler(request));
    }
}
