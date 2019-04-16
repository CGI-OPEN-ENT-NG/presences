import {_, notify} from 'entcore';
import http from 'axios';

export class Student {
    id: string;
    firstName: string;
    lastName: string;
    idClasse: string;
    displayName: string;

    constructor(o?: any) {
        if (o && typeof o === 'object') {
            for (let key in o) {
                this[key] = o[key];
            }
        }
    }

    toString() {
        return this.hasOwnProperty("displayName") ? this.displayName : this.firstName + " " + this.lastName;
    }
}

export class Students {
    all: Student[];

    constructor() {
        this.all = [];
    }

    /**
     * Return student ids array of this.all
     */
    getIds () {
        return _.pluck(this.all, "studentId");
    }

    /**
     * Synchronize student provides by the structure
     * @param structureId structure id
     * @returns {Promise<void>}
     */
    async sync(structureId: string): Promise<void> {
        if (typeof structureId !== 'string') {
            return;
        }
        try {
            let url = `/viescolaire/classe/eleves?idEtablissement=${structureId}`;
            const {data} = await http.get(url);
            this.all = data.map((item)=> {
                return new Student(item);
            });
            return;
        } catch (e) {
            notify.error('app.notify.e500');
        }
    }

    async search(structureId: String, text: String) {
        try {
            if ((text.trim() === '' || !text)) return;
            text = text.replace("\\s", "").toLowerCase()
            const {data} = await http.get(`/viescolaire/user/search?structureId=${structureId}&profile=Student&q=${text}&field=displayNameSearchField`);
            this.all = data.map((item) => {
                return new Student(item);
            });
        } catch (err) {
            notify.error('presences.students.search.err');
            throw err;
        }
    }
}