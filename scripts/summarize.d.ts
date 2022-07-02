/** JSON API type */
export interface OkrApi {
  /** Last updated date */
  updatedAt: string;

  /** OKR key-value pair with year and data */
  years: {
    name: number;
    progress: number;
    success: number;
    quarters: {
      name: number;
      progress: number;
      success: number;
      objectives: {
        name: string;
        progress: number;
        success: number;
        key_results: {
          name: string;
          target_result: number;
          current_result: number;
          progress: number;
          success: number;
        }[];
      }[];
    }[];
  }[];
}

/** OKR item based on ../schema.json */
export interface OkrItem {
  /** Year */
  year: number;

  /** Quarter */
  quarter: 1 | 2 | 3 | 4;

  /** Objectives for this quarter */
  objectives: {
    /** Name of objective */
    name: string;

    /** Key results for this objective */
    key_results: {
      /** Name of key result */
      name: string;

      /** Target value */
      target_result: number;

      /** Currently achieved value */
      current_result: number;
    }[];
  }[];
}
