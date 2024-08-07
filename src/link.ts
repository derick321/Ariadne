document.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", async (event) => {
    let from: string = window.location.href;
    let to: string = link.href;
    let tos: Array<string> = [];
    await chrome.storage.local.get(from).then((result) => {
      if (result[from] !== undefined) {
        console.log("before: ", result[from]);
        tos = result[from];
      }
    });
    if (tos.length > 0 && tos.indexOf(to) >= 0) {
      console.log("no new visit");
      return;
    }
    tos.push(to);
    let fromTo: any = {};
    fromTo[from] = tos;
    await chrome.storage.local.set(fromTo);
    chrome.storage.local.get(from, (result) => {
      console.log("after: ", result);
    });
  });
});
