/** @typedef { import("./summarize").OkrItem } OkrItem */
/** @typedef { import("./summarize").OkrApi } OkrApi */

import { resolve, join, extname } from "path";
import { readdir, readFile, writeFile } from "fs/promises";

/**
 * Summarize OKRs and generate `./README.md` and `./api.json`
 * @example `node scripts/summarize.mjs run`
 */
export async function summarize() {
  /** @type {OkrApi} */
  const api = { updatedAt: new Date().toISOString(), years: [] };

  for await (const fileName of getFiles(join(".", "okrs"))) {
    if (extname(fileName) !== ".json") {
      console.warn("Got non-JSON file, skipping", fileName);
      continue;
    }

    /** @type {OkrItem} */
    const contents = JSON.parse(await readFile(fileName, "utf8"));
    /** @type {OkrApi["years"][0]["quarters"][0]} */
    if (!api.years.find((year) => year.name === contents.year))
      api.years.push({
        name: contents.year,
        progress: 0,
        success: 0,
        quarters: [],
      });
    const quarter = {
      name: contents.quarter,
      progress: 0,
      success: 0,
      objectives: [],
    };

    const quarterStartDate = new Date();
    quarterStartDate.setUTCFullYear(contents.year);
    quarterStartDate.setUTCMonth((quarter.name - 1) * 3);
    quarterStartDate.setUTCDate(1);
    quarterStartDate.setUTCHours(0);
    quarterStartDate.setUTCMinutes(0);
    quarterStartDate.setUTCSeconds(0);
    quarterStartDate.setUTCMilliseconds(0);
    const quarterCompleted = roundTwoDecimals(
      Math.min(
        1,
        Math.round(
          (new Date().getTime() - quarterStartDate.getTime()) / 86400000
        ) / 91.25
      )
    );

    contents.objectives.forEach((objective) => {
      quarter.objectives.push({
        name: objective.name,
        progress: 0,
        success: 0,
        key_results: objective.key_results.map(
          ({ name, current_result, target_result }) => ({
            name,
            current_result,
            target_result,
            progress: roundTwoDecimals(current_result / target_result),
            success: roundTwoDecimals(
              current_result / target_result / quarterCompleted
            ),
          })
        ),
      });
    });
    api.years = api.years.map((year) => {
      if (year.name === contents.year)
        return { ...year, quarters: [...year.quarters, quarter] };
      return year;
    });
  }

  api.years = api.years
    .map((year) => {
      const yearStartDate = new Date();
      yearStartDate.setUTCFullYear(year.name);
      yearStartDate.setUTCMonth(0);
      yearStartDate.setUTCDate(1);
      yearStartDate.setUTCHours(0);
      yearStartDate.setUTCMinutes(0);
      yearStartDate.setUTCSeconds(0);
      yearStartDate.setUTCMilliseconds(0);
      const yearCompleted = roundTwoDecimals(
        Math.min(
          1,
          Math.round(
            (new Date().getTime() - yearStartDate.getTime()) / 86400000
          ) / 365.25
        )
      );

      year.quarters = year.quarters
        .map((quarter) => {
          const objectives = quarter.objectives.map((objective) => {
            return {
              ...objective,
              progress: roundTwoDecimals(
                objective.key_results
                  .map(
                    (keyResult) =>
                      keyResult.current_result / keyResult.target_result
                  )
                  .reduce((a, b) => a + b, 0) / objective.key_results.length
              ),
              success: roundTwoDecimals(
                objective.key_results
                  .map((keyResult) => keyResult.success)
                  .reduce((a, b) => a + b, 0) / objective.key_results.length
              ),
            };
          });
          return {
            ...quarter,
            objectives,
            progress: roundTwoDecimals(
              objectives
                .map((objective) => objective.progress)
                .reduce((a, b) => a + b, 0) / objectives.length
            ),
            success: roundTwoDecimals(
              objectives
                .map((objective) => objective.success)
                .reduce((a, b) => a + b, 0) / objectives.length
            ),
          };
        })
        .sort((a, b) => b.name - a.name);
      year.progress = roundTwoDecimals(
        year.quarters
          .map((quarter) => quarter.progress)
          .reduce((a, b) => a + b, 0) / year.quarters.length
      );
      year.success = roundTwoDecimals(
        year.quarters
          .map((quarter) => quarter.progress)
          .reduce((a, b) => a + b, 0) /
        year.quarters.length /
        yearCompleted
      );
      return year;
    })
    .sort((a, b) => b.name - a.name);

  writeFile(join(".", "api.json"), `${JSON.stringify(api, null, 2)}\n`);

  /** @type {string} */
  const README = await readFile(join(".", "README.md"), "utf8");
  let summary = api.years
    .flatMap((year) =>
      year.quarters.map((quarter) => ({ ...quarter, year: year.name }))
    )
    .map(
      (quarter, index) => `${index === 0
        ? `## 📈 Current OKRs – Q${quarter.name} ${quarter.year} (${roundTwoDecimals(quarter.success * 100)}%)\n\n`
        : index === 1
          ? "## ✅ Past OKRs\n\n"
          : ""
        }${index === 0
          ? "<div>"
          : `<details>\n  <summary>Q${quarter.name} ${quarter.year} (${roundTwoDecimals(quarter.success * 100)}%)</summary>`
        }
  <table>
    <thead>
      <tr>
        <th>OKR</th>
        <th>Success</th>
        <th colspan="2">Progress</th>
      </tr>
    </thead>
    <tbody>
  ${quarter.objectives
          .map(
            (objective) => `    <tr>
        <td><strong>${objective.name}</strong></td>
        <td><strong>${roundTwoDecimals(objective.success * 100)}%</strong></td>
        <td>${"🟩".repeat(Math.round(objective.progress * 10))}${"⬜".repeat(
              10 - Math.round(objective.progress * 10)
            )}</td>
        <td><strong>${roundTwoDecimals(objective.progress * 100)}%</strong></td>
      </tr>
  ${objective.key_results
                .map(
                  (keyResult) =>
                    `    <tr>
        <td>↳ ${keyResult.name}</td>
        <td>${roundTwoDecimals(keyResult.success * 100)}%</td>
        <td>${"🟨".repeat(Math.min(10, Math.round(keyResult.progress * 10)))}${"⬜".repeat(
                      Math.max(0, 10 - Math.round(keyResult.progress * 10))
                    )}</td>
        <td>${roundTwoDecimals(keyResult.progress * 100)}%</td>
      </tr>`
                )
                .join("\n")}`
          )
          .join("\n")}
    </tbody>
  </table>
${index === 0 ? "</div>" : "</details>"}
  `
    )
    .join("\n");

  writeFile(
    join(".", "README.md"),
    `${README.split("<!-- start autogenerated OKR summary -->")[0]
    }<!-- start autogenerated OKR summary -->

${summary.trim()}

<!-- end autogenerated OKR summary -->${README.split("<!-- end autogenerated OKR summary -->")[1]
    }`
  );
}

/**
 * Recursively list all files in a directory
 * @param {string} dir - Directory to walk
 * @returns {AsyncGenerator<string>}
 * @link https://stackoverflow.com/a/45130990/1656944
 * @license CC BY-SA 4.0
 */
async function* getFiles(directory) {
  const contents = await readdir(directory, { withFileTypes: true });
  for (const item of contents) {
    const res = resolve(directory, item.name);
    if (item.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

/**
 * Round a number to up to two decimal places
 * @param {number} value - Number to round
 * @returns {number} - Rounded value
 */
function roundTwoDecimals(value) {
  return Math.round(value * 100) / 100;
}

// Run summarize() if using via CLI
if (process.argv.pop() === "run") summarize();
