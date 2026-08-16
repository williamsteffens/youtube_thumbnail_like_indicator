export function addIndicator(thumbnail) {
    if (thumbnail.querySelector(".like-indicator"))
        return;

    const badge = document.createElement("div");

    badge.className = "like-indicator";
    badge.textContent = "👍";

    thumbnail.appendChild(badge);
}