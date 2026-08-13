// Mounts the DS&AI form through the shared SurveyJS application shell.
import { mountProgramForm } from "../shared/app.js";
import { dsaiFormConfig } from "../programmes/dsai/index.js";

mountProgramForm(dsaiFormConfig);
