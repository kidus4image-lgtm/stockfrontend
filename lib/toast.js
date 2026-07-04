import { toast } from 'react-toastify';

export const showSuccess = (msg) => toast.success(msg, { position: 'top-right', autoClose: 3000 });
export const showError = (msg) => toast.error(msg, { position: 'top-right', autoClose: 5000 });
export const showInfo = (msg) => toast.info(msg, { position: 'top-right', autoClose: 3000 });
export const showWarning = (msg) => toast.warning(msg, { position: 'top-right', autoClose: 4000 });
