document.addEventListener("DOMContentLoaded", () => {
  const getFileIcon = (extension) => {
    const ext = extension.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) {
      return "image";
    }
    switch (ext) {
      case "pdf":
        return "picture_as_pdf";
      case "doc":
      case "docx":
        return "description";
      case "xls":
      case "xlsx":
        return "spreadsheet";
      case "txt":
        return "article";
      default:
        return "draft";
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
        previewContainer.appendChild(img);
      } else {
        const icon = document.createElement("span");
        icon.className = "material-symbols-outlined";
        icon.textContent = fileType;
        previewContainer.appendChild(icon);
      }
    });
  };

  generatePreviews();
});
