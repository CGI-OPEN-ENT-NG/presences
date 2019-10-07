import {ng} from 'entcore'
import http from 'axios';
import {Place, Partner, IncidentType, ProtagonistType} from "@incidents/services";

export interface IncidentParameterType {
    place: Place[];
    partner: Partner[];
    incidentType: IncidentType[];
    seriousnessLevel: SeriousnessLevel[];
    protagonistType: ProtagonistType[];
}

export interface SeriousnessLevel {
    id: number;
    structureId: string;
    label: string;
    level: number;
}

export interface IncidentService {
    getIncidentParameterType(structureId: string): Promise<IncidentParameterType>
}

export const incidentService: IncidentService = {
    getIncidentParameterType: async (structureId: string) => {
        try {
            const {data} = await http.get(`/incidents/incidents/parameter/types?structureId=${structureId}`);
            return data;
        } catch (err) {
            throw err;
        }
    }
};

export const IncidentService = ng.service('IncidentService', (): IncidentService => incidentService);

