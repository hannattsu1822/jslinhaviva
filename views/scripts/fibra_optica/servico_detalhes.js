document.addEventListener("DOMContentLoaded", () => {
  const getFileIcon = (extension) => {
    const ext = extension.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
      return "image";
    }
    switch (ext) {
      case "pdf":
        return "fa-solid fa-file-pdf text-danger";
      case "doc":
      case "docx":
        return "fa-solid fa-file-word text-primary";
      case "xls":
      case "xlsx":
        return "fa-solid fa-file-excel text-success";
      case "txt":
        return "fa-solid fa-file-lines text-secondary";
      default:
        return "fa-solid fa-file text-muted";
    }
  };

  const generatePreviews = () => {
    const attachmentCards = document.querySelectorAll(".attachment-card");
    attachmentCards.forEach((card) => {
      const previewContainer = card.querySelector(".attachment-preview");
      const filename = card.dataset.filename || "";
      const fileUrl = card.href;
      const extension = filename.split(".").pop();

      const fileType = getFileIcon(extension);

      if (fileType === "image") {
        const img = document.createElement("img");
        img.src = fileUrl;
        img.alt = `Pré-visualização de ${filename}`;
        img.className = "img-fluid";
        previewContainer.appendChild(img);
      } else {
        const icon = document.createElement("i");
        icon.className = `${fileType} fa-3x`;
        previewContainer.appendChild(icon);
      }
    });
  };

  generatePreviews();
});
