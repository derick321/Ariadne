import { makeUrlTree, createVisit, Visit } from "./tree";

const kMillisecondsPerWeek = 1000 * 60 * 60 * 24 * 7;
const kOneWeekAgo = new Date().getTime() - kMillisecondsPerWeek;
const historyDiv = document.getElementById("historyDiv")!;

// createJourney recursively creates journey elements
async function createJourney(
  journey: Visit,
  template: HTMLTemplateElement,
  depth: number,
  parentNode: HTMLElement
) {
  // Create root element for this journey
  let div = document.createElement("div");
  div.classList.add("journey");
  await createVisit(journey, template, depth, div);
  if (journey.to.length == 0) {
    div.querySelector(".toggle-wrapper")!.remove();
    parentNode.appendChild(div);
    return;
  }
  // Create children elements
  for (let to of journey.to) {
    createJourney(to, template, depth + 1, div);
  }
  parentNode.appendChild(div);
}

// constructHistory makes a history tree and create elements of Journeys
async function constructHistory(historyItems: chrome.history.HistoryItem[]) {
  let urlTree = await makeUrlTree(historyItems);
  const template: HTMLTemplateElement = <HTMLTemplateElement>(
    document.getElementById("historyTemplate")!
  );
  if (template === null) return;

  for (let journey of urlTree) {
    createJourney(journey, template, 0, historyDiv);
  }
}

let onlyJourney = document.getElementById("onlyJourney")!
onlyJourney.onclick = async () => {
  let hide = onlyJourney.classList.toggle("onlyJourney")
  document.querySelectorAll(".notJourney").forEach((element) => {
    if (hide)
      (<HTMLElement>element).style.display = "none";
    else (<HTMLElement>element).style.display = "flex";
  })
}

// Create history page
chrome.history
  .search({
    text: "",
    startTime: kOneWeekAgo,
    maxResults: 199,
  })
  .then(constructHistory);
