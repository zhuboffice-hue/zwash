import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';

export const seedCeramicServices = async (db, user) => {
    const services = [
        {
            name: "Ceramic Coating Grade I",
            category: "Ceramic",
            description: "Warranty 1 year, Thickness ~3micron, Hydrophobic Good, Scratch Resistance High. Maintenance Value ₹5,000.",
            prices: {
                bike: 6499,
                hatchback: 16499,
                sedan: 19999,
                suv: 22499,
                luxury: 25499
            },
            durationMinutes: 240, // 4 hours est
            isActive: true,
            sortOrder: 10
        },
        {
            name: "Ceramic Coating Grade II",
            category: "Ceramic",
            description: "Warranty 3 years, Thickness ~5micron, Hydrophobic Very Good, Scratch Resistance Very High. Maintenance Value ₹6,000.",
            prices: {
                bike: 8499,
                hatchback: 33499,
                sedan: 39999,
                suv: 45499,
                luxury: 49999 
            },
            durationMinutes: 360, // 6 hours est
            isActive: true,
            sortOrder: 11
        },
        {
            name: "Graphene Coating",
            category: "Ceramic",
            description: "Warranty 5 years, Thickness ~8micron, Hydrophobic Excellent, Scratch Resistance Maximum. Maintenance Value ₹7,000.",
            prices: {
                bike: 11999,
                hatchback: 59999,
                sedan: 69999,
                suv: 79999,
                luxury: 89999 
            },
            durationMinutes: 480, // 8 hours est
            isActive: true,
            sortOrder: 12
        }
    ];

    let checkCount = 0;
    let addedCount = 0;

    for (const service of services) {
        // Check if exists
        const q = query(collection(db, 'services'), where('name', '==', service.name));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            await addDoc(collection(db, 'services'), {
                ...service,
                createdAt: new Date(),
                createdBy: user?.email || 'System Seed'
            });
            addedCount++;
        }
        checkCount++;
    }

    return { checkCount, addedCount };
};
