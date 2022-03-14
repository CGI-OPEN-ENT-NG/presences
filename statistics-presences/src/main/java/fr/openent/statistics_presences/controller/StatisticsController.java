package fr.openent.statistics_presences.controller;

import fr.openent.presences.common.helper.*;
import fr.openent.presences.core.constants.*;
import fr.openent.statistics_presences.StatisticsPresences;
import fr.openent.statistics_presences.controller.security.UserInStructure;
import fr.openent.statistics_presences.enums.*;
import fr.openent.statistics_presences.indicator.Indicator;
import fr.openent.statistics_presences.indicator.export.Global;
import fr.openent.statistics_presences.model.StatisticsFilter;
import fr.openent.statistics_presences.service.CommonServiceFactory;
import fr.openent.statistics_presences.service.StatisticsPresencesService;
import fr.wseduc.rs.ApiDoc;
import fr.wseduc.rs.Get;
import fr.wseduc.rs.Post;
import fr.wseduc.security.ActionType;
import fr.wseduc.security.SecuredAction;
import fr.wseduc.webutils.http.Renders;
import fr.wseduc.webutils.request.RequestUtils;
import io.vertx.core.*;
import io.vertx.core.http.HttpServerRequest;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import org.entcore.common.controller.ControllerHelper;
import org.entcore.common.http.filter.AdminFilter;
import org.entcore.common.http.filter.ResourceFilter;
import org.entcore.common.user.UserUtils;

import java.lang.reflect.InvocationTargetException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class StatisticsController extends ControllerHelper {
    private final StatisticsPresencesService statisticsPresencesService;
    private final CommonServiceFactory serviceFactory;

    public StatisticsController(CommonServiceFactory serviceFactory) {
        this.serviceFactory = serviceFactory;
        this.statisticsPresencesService = serviceFactory.statisticsPresencesService();
    }

    @Get("")
    @SecuredAction(StatisticsPresences.VIEW)
    public void view(HttpServerRequest request) {
        UserUtils.getUserInfos(eb, request, user -> {
            JsonObject action = new JsonObject()
                    .put("action", "user.getActivesStructure")
                    .put("module", "presences")
                    .put("structures", new JsonArray(user.getStructures()));
            eb.send("viescolaire", action, event -> {
                JsonObject body = (JsonObject) event.result().body();
                if (event.failed() || "error".equals(body.getString("status"))) {
                    log.error("[Presences@PresencesController] Failed to retrieve actives structures");
                    renderError(request);
                } else {
                    JsonObject params = new JsonObject().put("structures", body.getJsonArray("results", new JsonArray()));
                    params.put("indicators", indicatorList());
                    renderView(request, params);
                }
            });
        });
    }

    private JsonArray indicatorList() {
        return new JsonArray(new ArrayList<>(StatisticsPresences.indicatorMap.keySet().stream().sorted().collect(Collectors.toList())));
    }

    @Post("/structures/:structure/indicators/:indicator")
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @ResourceFilter(UserInStructure.class)
    public void fetch(HttpServerRequest request) {
        String indicatorName = request.getParam(Field.INDICATOR);
        if (!StatisticsPresences.indicatorMap.containsKey(indicatorName)) {
            notFound(request);
            return;
        }

        RequestUtils.bodyToJson(request, pathPrefix + Field.INDICATOR, body -> {

                try {

                    Integer page = request.params().contains(Field.PAGE) ? Integer.parseInt(request.getParam(Field.PAGE)) : null;
                    StatisticsFilter filter = new StatisticsFilter(request.getParam(Field.STRUCTURE), body)
                            .setPage(page);

                    setRestrictedTeacherFilter(filter, request)
                            .onFailure(fail -> renderError(request))
                            .onSuccess(event -> {
                                Indicator indicator = StatisticsPresences.indicatorMap.get(indicatorName);
                                indicator.search(filter, Indicator.handler(request));
                            });

                } catch (NumberFormatException e) {
                    badRequest(request);
                }
        });
    }

    @Post("/structures/:structure/indicators/:indicator/graph")
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @ResourceFilter(UserInStructure.class)
    public void fetchGraph(HttpServerRequest request) {
        String indicatorName = request.getParam(Field.INDICATOR);
        if (!StatisticsPresences.indicatorMap.containsKey(indicatorName)) {
            notFound(request);
            return;
        }
        RequestUtils.bodyToJson(request, pathPrefix + Field.INDICATOR, body -> {
            try {
                StatisticsFilter filter = new StatisticsFilter(request.getParam(Field.STRUCTURE), body);

                setRestrictedTeacherFilter(filter, request)
                        .onFailure(fail -> renderError(request))
                        .onSuccess(event -> {
                            Indicator indicator = StatisticsPresences.indicatorMap.get(indicatorName);
                            indicator.searchGraph(filter, Indicator.handler(request));
                        });

            } catch (NumberFormatException e) {
                badRequest(request);
            }
        });
    }

    @Get("/structures/:structure/indicators/:indicator/export")
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @ResourceFilter(UserInStructure.class)
    @SuppressWarnings("unchecked")
    public void export(HttpServerRequest request) {
        StatisticsFilter filter = new StatisticsFilter(request);

        setRestrictedTeacherFilter(filter, request)
                .onFailure(fail -> renderError(request))
                .onSuccess(event -> {
                    String indicatorName = request.getParam(Field.INDICATOR);
                    Indicator indicator = StatisticsPresences.indicatorMap.get(indicatorName);
                    indicator.search(filter, ar -> {
                        if (ar.failed()) {
                            log.error(String.format("[Presences@%s::export] Search failed for indicator %s " +
                                    "in csv export", this.getClass().getSimpleName(), Global.class.getSimpleName()), ar.cause());
                            Renders.renderError(request);
                            return;
                        }

                        try {
                            JsonObject searchResult = ar.result();
                            indicator.export(request, filter,
                                    searchResult.getJsonArray(Field.DATA).getList(),
                                    searchResult.getJsonObject(Field.COUNT),
                                    searchResult.getJsonObject(Field.SLOTS),
                                    searchResult.getJsonObject(Field.RATE),
                                    searchResult.getString(Field.EVENT_RECOVERY_METHOD));
                        } catch (ClassNotFoundException | IllegalAccessException | InvocationTargetException | InstantiationException e) {
                            log.error(String.format("[Presences@%s::export] Failed to generate export for indicator %s",
                                    this.getClass().getSimpleName(), indicator.getClass().getSimpleName()), e);
                        }
                    });
                });
    }

    private Future<Void> setRestrictedTeacherFilter(StatisticsFilter filter, HttpServerRequest request) {
        Promise<Void> promise = Promise.promise();

        UserUtils.getUserInfos(eb, request, userInfos -> {
            String restrictedTeacherId = (WorkflowHelper.hasRight(userInfos,
                    WorkflowActions.STATISTICS_PRESENCES_VIEW_RESTRICTED.toString())
                    && UserType.TEACHER.equals(userInfos.getType())) ?
                    userInfos.getUserId() : null;

            Future<List<String>> restrictedClassesFuture = serviceFactory.groupService()
                    .getGroupsAndClassesFromTeacherId(restrictedTeacherId, request.getParam(Field.STRUCTURE));

            Future<List<String>> restrictedStudentFuture = serviceFactory.userService()
                    .getStudentsFromTeacher(restrictedTeacherId, request.getParam(Field.STRUCTURE));

            CompositeFuture.all(restrictedClassesFuture, restrictedStudentFuture)
                    .onFailure(fail -> promise.fail(fail.getMessage()))
                    .onSuccess(event -> {
                        List<String> restrictedClasses = restrictedClassesFuture.result();
                        List<String> restrictedStudents = restrictedStudentFuture.result();

                        if (restrictedTeacherId != null) {
                            if (filter.audiences().isEmpty() && filter.users().isEmpty()) {
                                filter.setAudiences(restrictedClasses);
                            } else {
                                if (!filter.users().isEmpty()) {
                                    filter.setNewUsers(filter.users().stream()
                                            .filter(restrictedStudents::contains).collect(Collectors.toList()));
                                    filter.setAudiences(new ArrayList<>());
                                    if (filter.users().isEmpty()) {
                                        filter.setNewUsers(null);

                                    }
                                } else {
                                    filter.setAudiences(filter.audiences().stream()
                                            .filter(restrictedClasses::contains).collect(Collectors.toList()));
                                    if (filter.audiences().isEmpty()) {
                                        filter.setAudiences(null);
                                    }
                                }
                            }
                        }

                        promise.complete();
                    });

        });


        return promise.future();
    }

    @Post("/process/statistics/tasks")
    @SecuredAction(value = "", type = ActionType.RESOURCE)
    @ResourceFilter(AdminFilter.class)
    @ApiDoc("Generate notebook archives")
    @SuppressWarnings("unchecked")
    public void processStatisticsPrefetch(final HttpServerRequest request) {
        RequestUtils.bodyToJson(request, pathPrefix + "processStatisticsPrefetch", body -> {
            List<String> structure = body.getJsonArray("structure").getList();
            statisticsPresencesService.processStatisticsPrefetch(structure)
                    .onSuccess(res -> renderJson(request, res))
                    .onFailure(unused -> renderError(request));
        });
    }
}
