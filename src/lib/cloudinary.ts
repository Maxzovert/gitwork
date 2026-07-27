export async function uploadFile(
  file: File,
  setProgress?: (progress: number) => void,
): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  const folder = process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  if (folder) {
    formData.append("folder", folder);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Audio is treated as "video" by Cloudinary
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
    );

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && setProgress) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText) as {
          secure_url: string;
        };
        resolve(response.secure_url);
        return;
      }

      let message = `Upload failed with status ${xhr.status}`;
      try {
        const errorBody = JSON.parse(xhr.responseText) as {
          error?: { message?: string };
        };
        if (errorBody.error?.message) {
          message = errorBody.error.message;
        }
      } catch {
        // keep default message
      }

      reject(new Error(message));
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.send(formData);
  });
}
