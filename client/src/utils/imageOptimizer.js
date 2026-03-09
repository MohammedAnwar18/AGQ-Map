/**
 * Image Optimizer Utility
 * Compresses and resizes images on the client side before upload
 * to save storage space and bandwidth.
 */

export const optimizeImage = async (file, options = {}) => {
    const {
        maxWidth = 1024,
        maxHeight = 1024,
        quality = 0.7,
        type = 'image/webp'
    } = options;

    // If it's not an image, return original file (e.g. video)
    if (!file.type.startsWith('image/')) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions while maintaining aspect ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to Blob
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Canvas to Blob conversion failed'));
                            return;
                        }
                        // Create a new file from the blob
                        const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                            type: type,
                            lastModified: Date.now(),
                        });
                        resolve(optimizedFile);
                    },
                    type,
                    quality
                );
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};
