/** Registration UX fix, 2026-08-10 — prefilled dropdown instead of free text; 'Outro' reveals a custom text field. */
export const INSTITUTION_TYPES = ['ONG', 'Orfanato', 'Igreja', 'Escola', 'Centro Comunitário', 'Outro'] as const;
export type InstitutionTypeOption = (typeof INSTITUTION_TYPES)[number];

export const ANIMAL_SHELTER_TYPES = ['Abrigo de Cães', 'Gatil', 'Santuário', 'Outro'] as const;
export type AnimalShelterTypeOption = (typeof ANIMAL_SHELTER_TYPES)[number];
