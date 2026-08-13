// Mounts the IAM form through the shared SurveyJS application shell.
import { mountProgramForm } from "../shared/app.js";
import { iamFormConfig } from "../programmes/iam/index.js";

mountProgramForm(iamFormConfig);
