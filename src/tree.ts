const historyDiv = document.getElementById("historyDiv")!;
const marginStep = 35;

type Visit = {
  url: string;
  title: string;
  lastVisitTime: number;
  to: Visit[];
  root: string;
  hasFrom: boolean;
};

type URLTree = Array<Visit>;

// faviconURL creates a URL for favicon of a page
function faviconURL(u: string) {
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", u);
  url.searchParams.set("size", "24");
  return url.toString();
}

function urlIndex(urlTree: URLTree, url: string) {
  for (let i = 0; i < urlTree.length; i++) {
    if (url === urlTree[i].url) {
      return i;
    }
  }
  return -1;
}

function newVisit(item: chrome.history.HistoryItem): Visit {
  return {
    url: item.url!,
    title: item.title!,
    lastVisitTime: item.lastVisitTime!,
    to: [],
    root: item.url!,
    hasFrom: false,
  };
}

// changeRoot changes root of visit and its children
function changeRoot(visit: Visit, url: string) {
  visit.root = url;
  if (visit.to.length > 0) {
    for (let to of visit.to) {
      changeRoot(to, url);
    }
  }
}

// buildTree builds hierarchy of urlTree
async function buildTree(urlTree: URLTree) {
  let changed = false;
  for (let visit of urlTree) {
    // Fetch destinations from local storage to 'tos'
    let tos: string[] = [];
    await chrome.storage.local.get(visit.url).then((result) => {
      if (result[visit.url] !== undefined) {
        tos = result[visit.url];
      }
    });

    // build tree structure
    if (tos.length > 0) {
      for (let to of tos) {
        let index = urlIndex(urlTree, to);
        if (
          index >= 0 &&
          visit.to.indexOf(urlTree[index]) < 0 &&
          urlTree[index].root != visit.root
        ) {
          let child = urlTree[index];
          changeRoot(child, visit.root);
          visit.to.push(child);
          urlTree[index].hasFrom = true;
          changed = true;
        }
      }
    }
  }
  return changed;
}

// makeUrlTree makes a tree of URLs from historyItems with 'to' data.
async function makeUrlTree(historyItems: chrome.history.HistoryItem[]) {
  // Add historyItems to urlTree
  let urlTree: URLTree = [];
  for (let item of historyItems) {
    let visit = newVisit(item);
    try {
      newVisit(item);
      urlTree.push(visit);
    } catch (e) {
      console.log("invalid historyItem: ", e);
    }
  }
  // Build hierarchy of urlTree
  await buildTree(urlTree);
  // Remove non-root elements
  let onlyRoot: URLTree = [];
  for (let visit of urlTree) {
    if (!visit.hasFrom) {
      onlyRoot.push(visit);
    }
  }
  return onlyRoot;
}

function toggleResolveFunc(history: HTMLDivElement, item: Visit) {
  return async function () {
    // Toggle resolved class
    history.classList.toggle("resolved");

    let resolved = history.classList.contains("resolved");
    let resolvedList: string[] = [];
    // Get resolvedList
    await chrome.storage.local.get("resolvedList").then((result) => {
      if (result["resolvedList"] !== undefined) {
        resolvedList = result["resolvedList"];
        console.log("before: ", resolvedList);
      }
    });
    // Update resolvedList
    if (resolved && resolvedList.indexOf(item.url) < 0) {
      resolvedList.push(item.url);
      let resolvedStored: any = {};
      resolvedStored["resolvedList"] = resolvedList;
      await chrome.storage.local.set(resolvedStored);
      console.log("after: ", resolvedList);
    } else if (!resolved && resolvedList.indexOf(item.url) >= 0) {
      resolvedList.splice(resolvedList.indexOf(item.url), 1);
      let resolvedStored: any = {};
      resolvedStored["resolvedList"] = resolvedList;
      await chrome.storage.local.set(resolvedStored);
      console.log("after: ", resolvedList);
    }
  }
}

function toggleTreeFunc(journey: HTMLElement) {
  return function () {
    journey.querySelectorAll(".journey").forEach((element) => {
      element.classList.toggle("folded")
    })
  }
}

// createVisit creates an actual history element and add it to DOM(historyDiv)
async function createVisit(
  item: Visit,
  template: HTMLTemplateElement,
  depth: number,
  parentNode: HTMLElement,
) {
  const clone = document.importNode(template.content, true);
  const pageLinkEl: HTMLAnchorElement = clone.querySelector(".page-link")!;
  const pageTitleEl: HTMLParagraphElement = clone.querySelector(".page-title")!;
  const imageWrapperEl: HTMLDivElement = clone.querySelector(".image-wrapper")!;
  const toggleCheck = clone.querySelector(".toggle-check")!;
  const favicon = document.createElement("img");
  pageLinkEl.href = item.url;
  favicon.src = faviconURL(item.url);
  pageLinkEl.textContent = item.url;
  imageWrapperEl.prepend(favicon);
  if (!item.title) {
    pageTitleEl.style.display = "none";
  }
  pageTitleEl.innerText = item.title;

  let history: HTMLDivElement = clone.querySelector(".history")!;
  history.style.marginLeft = marginStep * depth + "px";
  if (item.to.length == 0 && depth == 0) {
    history.classList.add("notJourney");
  }

  let resolvedList: string[] = [];
  await chrome.storage.local.get("resolvedList").then((result) => {
    if (result["resolvedList"] !== undefined) {
      resolvedList = result["resolvedList"];
    }
  });
  if (resolvedList.indexOf(item.url) >= 0) {
    history.classList.add("resolved");
  }

  history.addEventListener("click", toggleResolveFunc(history, item));
  toggleCheck.addEventListener("click", toggleTreeFunc(parentNode));

  parentNode.appendChild(clone);
  return clone
}

export {createVisit, makeUrlTree, Visit}