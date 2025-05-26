document.getElementById("hide-button").addEventListener("click", () => {
  const button = document.getElementById("hide-button");
  const sidebar = document.getElementById("controls");

  button.classList.toggle("collapsed");
  sidebar.classList.toggle("collapsed");
});