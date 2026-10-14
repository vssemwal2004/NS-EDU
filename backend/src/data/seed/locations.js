// Copied from frontend/src/data/landing.js (cities) and destinations.js.
// Crops are windows into the approved 1784 × 882 city/state artwork.
const studyCities = [
  { name: 'Delhi NCR', landmark: 'India Gate', crop: [62, 185, 266, 223] },
  { name: 'Bengaluru', landmark: 'Vidhana Soudha', crop: [345, 185, 264, 223] },
  { name: 'Mumbai', landmark: 'Gateway of India', crop: [624, 185, 264, 223] },
  { name: 'Hyderabad', landmark: 'Charminar', crop: [903, 185, 265, 223] },
  { name: 'Pune', landmark: 'Shaniwar Wada', crop: [1185, 185, 264, 223] },
  { name: 'Chennai', landmark: 'Chennai Central Station', crop: [1467, 185, 264, 223] },
];
const cityNames = ['Bengaluru', 'Pune', 'Delhi NCR', 'Mumbai', 'Hyderabad', 'Chennai', 'Ahmedabad', 'Kolkata'];

const studyStates = [
  { name: 'Madhya Pradesh', landmark: 'Sanchi Stupa', crop: [52, 622, 267, 131] },
  { name: 'Karnataka', landmark: 'Mysore Palace', crop: [335, 622, 267, 131] },
  { name: 'Maharashtra', landmark: 'Ajanta caves', crop: [619, 622, 266, 131] },
  { name: 'Uttar Pradesh', landmark: 'Taj Mahal', crop: [902, 622, 266, 131] },
  { name: 'Telangana', landmark: 'Golconda Fort', crop: [1186, 622, 266, 131] },
  { name: 'Tamil Nadu', landmark: 'Mahabalipuram Shore Temple', crop: [1469, 622, 266, 131] },
];
const stateNames = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim',
  'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

// Featured entries keep the artwork order; the rest follow their source order.
function directory(featured, names) {
  const rest = names.filter((name) => !featured.some((item) => item.name === name));
  return [
    ...featured.map((item, order) => ({ ...item, featured: true, order, active: true })),
    ...rest.map((name, index) => ({ name, landmark: '', crop: null, featured: false, order: featured.length + index, active: true })),
  ];
}

export const seedCities = directory(studyCities, cityNames);
export const seedStates = directory(studyStates, stateNames);
