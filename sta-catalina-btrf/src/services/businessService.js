import { getBusinesses } from "../services/businessService";

const data = await getBusinesses();

export const getBusinesses = () => {
    return window.api.invoke("business:getAll");
};

export const addBusiness = (data) => {
    return window.api.invoke("business:add", data);
};