const Joi = require('joi');

// Schémas de validation
const schemas = {
  createUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    nom: Joi.string().min(2).max(50).required(),
    role: Joi.string().valid('admin', 'instructeur', 'eleve').required()
  }),

  comment: Joi.object({
    comment: Joi.string().min(1).max(500).required(),
    name: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().optional(),
    parentId: Joi.string().optional()
  }),

  vote: Joi.object({
    type: Joi.string().valid('like', 'dislike').required()
  }),

  course: Joi.object({
    title: Joi.string().min(3).max(100).required(),
    instructorId: Joi.string().required(),
    schedule: Joi.string().required()
  }),

  upload: Joi.object({
    uid: Joi.string().required()
  }),

  // Nouveau schéma pour la mise à jour du profil élève
  updateStudentProfile: Joi.object({
    firstName: Joi.string().min(2).max(50).optional(),
    lastName: Joi.string().min(2).max(50).optional(),
    email: Joi.string().email().optional(),
    phone: Joi.string().pattern(/^[0-9+\s\-\(\)]{8,15}$/).optional().allow(''),
    telephone: Joi.string().pattern(/^[0-9+\s\-\(\)]{8,15}$/).optional().allow(''),
    dateOfBirth: Joi.string().isoDate().optional(),
    dateNaissance: Joi.string().isoDate().optional(),
    address: Joi.string().max(200).optional().allow(''),
    adresse: Joi.string().max(300).optional().allow(''),
    city: Joi.string().max(100).optional().allow(''),
    postalCode: Joi.string().pattern(/^[0-9A-Za-z\s\-]{3,10}$/).optional().allow(''),
    licenseType: Joi.string().valid('A', 'B', 'C', 'D', 'BE', 'CE', 'DE').optional(),
    instructorId: Joi.string().optional().allow(''),
    startDate: Joi.string().isoDate().optional(),
    theoreticalHours: Joi.number().min(0).optional(),
    practicalHours: Joi.number().min(0).optional(),
    status: Joi.string().valid('en attente', 'actif', 'en formation', 'terminé', 'suspendu').optional(),
    statut: Joi.string().valid('en attente', 'actif', 'en formation', 'terminé', 'suspendu').optional(),
    nextExam: Joi.string().isoDate().optional(),
    monitorComments: Joi.string().max(2000).optional().allow(''),
    theoreticalHoursMin: Joi.number().min(0).optional(),
    practicalHoursMin: Joi.number().min(0).optional(),
    profileImageUrl: Joi.string().uri().optional().allow(''),
    // Nouvelles propriétés
    numeroPermis: Joi.string().max(30).optional().allow(''),
    contactUrgence: Joi.string().max(200).optional().allow('')
  }).min(1),

  // Schéma pour la création d'une session
  createSession: Joi.object({
    studentId: Joi.string().required(),
    instructorId: Joi.string().required(),
    courseType: Joi.string().valid('code', 'conduite', 'autoroute', 'examen_blanc').required(),
    courseTitle: Joi.string().min(3).max(100).required(),
    scheduledDate: Joi.string().isoDate().required(),
    scheduledTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    duration: Joi.number().min(0.5).max(8).required(),
    location: Joi.string().max(100).optional(),
    notes: Joi.string().max(500).optional()
  }),

  // Schéma pour la mise à jour du statut d'une session
  updateSessionStatus: Joi.object({
    status: Joi.string().valid('présent', 'absent', 'en_retard', 'annulé').required(),
    notes: Joi.string().max(500).optional(),
    actualStartTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    actualEndTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
  }),

  addPresence: Joi.object({
    notes: Joi.string().max(500).optional(),
    actualStartTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    actualEndTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional()
  }),

  // Schéma pour les filtres de sessions
  sessionFilters: Joi.object({
    date: Joi.string().isoDate().optional(),
    instructorId: Joi.string().optional(),
    status: Joi.string().valid('présent', 'absent', 'en_retard', 'annulé').optional(),
    studentId: Joi.string().optional(),
    courseType: Joi.string().valid('code', 'conduite', 'autoroute', 'examen_blanc').optional(),
    startDate: Joi.string().isoDate().optional(),
    endDate: Joi.string().isoDate().optional()
  }),

  // Schéma pour les paramètres de notification
  notificationSettings: Joi.object({
    sessionReminders: Joi.boolean().required(),
    newsUpdates: Joi.boolean().required()
  }),

  // Schéma pour le changement de mot de passe
  changePassword: Joi.object({
    currentPassword: Joi.string().min(6).required(),
    newPassword: Joi.string().min(6).required()
  }),

  // Schéma pour l'authentification à deux facteurs
  twoFactorSettings: Joi.object({
    enabled: Joi.boolean().required()
  }),

  // Schéma pour la suppression de compte
  deleteAccount: Joi.object({
    confirmation: Joi.string().valid('SUPPRIMER').required()
  }),

  // Schéma pour le formulaire de contact
  contactForm: Joi.object({
    nomComplet: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    telephone: Joi.string().pattern(/^[0-9\s\+\-\(\)]+$/).optional(),
    sujet: Joi.string().min(5).max(200).required(),
    priorite: Joi.string().valid('Faible', 'Normale', 'Élevée', 'Urgente').default('Normale'),
    message: Joi.string().min(10).max(2000).required()
  })
};

// Middleware de validation générique
const validate = (schema) => {
  return (req, res, next) => {
    console.log('🔍 Validation des données:', req.body);
    
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true,
      allowUnknown: false
    });
    
    if (error) {
      console.error('❌ Erreur de validation:', error.details);
      
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        type: detail.type
      }));

      return res.status(400).json({
        error: 'Données invalides',
        message: 'Les données fournies ne respectent pas le format attendu',
        validationErrors: validationErrors,
        receivedData: req.body,
        debug: process.env.NODE_ENV === 'development' ? {
          schema: schema.describe(),
          errors: error.details
        } : undefined
      });
    }
    
    // Remplacer req.body par les données validées et nettoyées
    req.body = value;
    console.log('✅ Validation réussie:', value);
    next();
  };
};

// Middleware de validation pour les paramètres
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.params);
    if (error) {
      return res.status(400).json({
        error: 'Paramètres invalides',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

module.exports = {
  schemas,
  validate,
  validateParams
};
