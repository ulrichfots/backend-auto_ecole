require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();

// ✅ Configuration CORS avancée
app.use(cors({
  origin: [
    'http://localhost:52366', // Flutter Web local
    'http://localhost:3000',  // Front React local
    'https://ton-frontend.onrender.com' // Front déployé
  ],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// ✅ Configuration Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Auto École',
      version: '1.3.0',
      description: 'API complète pour la gestion d\'une auto-école avec authentification Firebase, inscriptions avec création automatique de comptes utilisateur, gestion des rôles, pages de profil, support et paramètres utilisateur',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Serveur de développement',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        DashboardStats: {
          type: 'object',
          properties: {
            moniteursActifs: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 12 },
                evolution: { type: 'string', example: '+2 ce mois' },
                trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' }
              }
            },
            elevesInscrits: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 247 },
                evolution: { type: 'string', example: '+15 ce mois' },
                trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' }
              }
            },
            comptesActifs: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 89 },
                evolution: { type: 'string', example: '+8% vs mois dernier' },
                trend: { type: 'string', enum: ['up', 'down', 'stable'], example: 'up' }
              }
            },
            enAttente: {
              type: 'object',
              properties: {
                total: { type: 'number', example: 5 },
                status: { type: 'string', example: 'Urgent à traiter' },
                priority: { type: 'string', enum: ['low', 'medium', 'high'], example: 'high' }
              }
            }
          }
        },
        RecentAccount: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'user123' },
            nom: { type: 'string', example: 'Jean Martin' },
            email: { type: 'string', example: 'jean.martin@autoecole.fr' },
            role: { type: 'string', enum: ['admin', 'instructeur', 'eleve'], example: 'eleve' },
            status: { type: 'string', example: 'Actif' },
            createdAt: { type: 'string', format: 'date-time' },
            timeAgo: { type: 'string', example: 'Il y a 2 jours' },
            initials: { type: 'string', example: 'JM' },
            profileImageUrl: { type: 'string', nullable: true }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Message d\'erreur' },
            details: { type: 'array', items: { type: 'string' }, nullable: true }
          }
        },
        Course: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'course123' },
            title: { type: 'string', example: 'Cours de conduite niveau 1' },
            instructorId: { type: 'string', example: 'instructor123' },
            studentId: { type: 'string', example: 'student123' },
            schedule: { type: 'string', example: '2024-01-15 10:00' },
            type: { type: 'string', enum: ['code', 'conduite', 'autoroute'], example: 'conduite' },
            status: { type: 'string', enum: ['scheduled', 'confirmed', 'completed'], example: 'scheduled' },
            duration: { type: 'number', example: 1 },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        StudentProgress: {
          type: 'object',
          properties: {
            category: { type: 'string', example: 'Code théorique' },
            type: { type: 'string', enum: ['code', 'conduite', 'autoroute'], example: 'code' },
            percentage: { type: 'number', example: 75 },
            completedHours: { type: 'number', example: 30 },
            totalHours: { type: 'number', example: 40 },
            color: { type: 'string', example: 'green' }
          }
        },
        StudentActivity: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'activity123' },
            type: { type: 'string', enum: ['test_passed', 'lesson_completed', 'lesson_scheduled'], example: 'test_passed' },
            title: { type: 'string', example: 'Test code réussi' },
            description: { type: 'string', example: 'Code test successful' },
            timestamp: { type: 'string', format: 'date-time' },
            timeAgo: { type: 'string', example: 'Il y a 2 heures' },
            icon: { type: 'string', example: 'check' },
            color: { type: 'string', example: 'green' }
          }
        },
        StudentObjective: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'objective123' },
            title: { type: 'string', example: 'Examen théorique' },
            description: { type: 'string', example: 'Theoretical exam' },
            type: { type: 'string', enum: ['theoretical_exam', 'practical_exam', 'license_obtained'], example: 'theoretical_exam' },
            targetDate: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['pending', 'scheduled', 'completed'], example: 'scheduled' },
            displayDate: { type: 'string', example: 'Prévu le 25 janvier 2024' },
            icon: { type: 'string', example: 'check' },
            color: { type: 'string', example: 'green' }
          }
        },
        StudentProfile: {
          type: 'object',
          properties: {
            uid: { type: 'string', example: 'student123' },
            nom: { type: 'string', example: 'Camille Roux' },
            email: { type: 'string', format: 'email', example: 'camille.roux@email.com' },
            statut: { type: 'string', enum: ['en attente', 'actif', 'en formation', 'terminé', 'suspendu'], example: 'actif' },
            dateInscription: { type: 'string', format: 'date-time', example: '2024-03-05T10:00:00Z' },
            idEleve: { type: 'string', example: '#7' },
            progressionGlobale: { type: 'number', example: 78 },
            coursTheoriques: {
              type: 'object',
              properties: {
                completed: { type: 'number', example: 12 },
                total: { type: 'number', example: 15 }
              }
            },
            exercicesPratiques: {
              type: 'object',
              properties: {
                completed: { type: 'number', example: 8 },
                total: { type: 'number', example: 10 }
              }
            },
            evaluations: {
              type: 'object',
              properties: {
                completed: { type: 'number', example: 3 },
                total: { type: 'number', example: 4 }
              }
            },
            activiteRecente: {
              type: 'array',
              items: { $ref: '#/components/schemas/ActivityItem' }
            },
            isFirstLogin: { type: 'boolean', example: false },
            profileImageUrl: { type: 'string', nullable: true },
            licenseType: { type: 'string', enum: ['A', 'B', 'C', 'D', 'BE', 'CE', 'DE'], example: 'B' },
            nextExam: { type: 'string', format: 'date-time', nullable: true },
            monitorComments: { type: 'string', example: 'Très bon élève, progression constante' }
          }
        },
        UpdateStudentProfile: {
          type: 'object',
          properties: {
            firstName: { type: 'string', example: 'Camille' },
            lastName: { type: 'string', example: 'Roux' },
            email: { type: 'string', format: 'email', example: 'camille.roux@email.com' },
            phone: { type: 'string', pattern: '^[0-9]{10}$', example: '0123456789' },
            dateOfBirth: { type: 'string', format: 'date', example: '1995-06-15' },
            address: { type: 'string', example: '123 Rue de la Paix' },
            city: { type: 'string', example: 'Paris' },
            postalCode: { type: 'string', pattern: '^[0-9]{5}$', example: '75001' },
            licenseType: { type: 'string', enum: ['A', 'B', 'C', 'D', 'BE', 'CE', 'DE'], example: 'B' },
            instructorId: { type: 'string', example: 'instructor123' },
            startDate: { type: 'string', format: 'date', example: '2024-01-15' },
            theoreticalHours: { type: 'number', minimum: 0, example: 12 },
            practicalHours: { type: 'number', minimum: 0, example: 8 },
            status: { type: 'string', enum: ['en attente', 'actif', 'en formation', 'terminé', 'suspendu'], example: 'actif' },
            nextExam: { type: 'string', format: 'date', example: '2024-06-15' },
            monitorComments: { type: 'string', example: 'Très bon élève' },
            theoreticalHoursMin: { type: 'number', minimum: 0, example: 40 },
            practicalHoursMin: { type: 'number', minimum: 0, example: 20 },
            profileImageUrl: { type: 'string', format: 'uri', example: 'https://example.com/profile.jpg' }
          }
        },
        SessionStats: {
          type: 'object',
          properties: {
            totalEleves: { type: 'number', example: 6 },
            presents: { type: 'number', example: 3 },
            absents: { type: 'number', example: 1 },
            enRetard: { type: 'number', example: 1 },
            annules: { type: 'number', example: 1 }
          }
        },
        Session: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'session123' },
            student: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'student123' },
                nom: { type: 'string', example: 'Marie Dubois' },
                email: { type: 'string', example: 'marie.dubois@email.com' },
                initials: { type: 'string', example: 'MD' }
              }
            },
            instructor: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'instructor123' },
                nom: { type: 'string', example: 'Jean Martin' }
              }
            },
            course: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['code', 'conduite', 'autoroute', 'examen_blanc'], example: 'conduite' },
                title: { type: 'string', example: 'Conduite pratique' }
              }
            },
            schedule: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date-time' },
                time: { type: 'string', example: '09:00' }
              }
            },
            status: { type: 'string', enum: ['présent', 'absent', 'en_retard', 'annulé'], example: 'présent' },
            progression: { type: 'number', example: 75 },
            actions: { type: 'array', items: { type: 'string' }, example: ['Détails', 'Modifier'] }
          }
        },
        CreateSession: {
          type: 'object',
          required: ['studentId', 'instructorId', 'courseType', 'courseTitle', 'scheduledDate', 'scheduledTime', 'duration'],
          properties: {
            studentId: { type: 'string', example: 'student123' },
            instructorId: { type: 'string', example: 'instructor123' },
            courseType: { type: 'string', enum: ['code', 'conduite', 'autoroute', 'examen_blanc'], example: 'conduite' },
            courseTitle: { type: 'string', example: 'Conduite pratique' },
            scheduledDate: { type: 'string', format: 'date', example: '2024-01-15' },
            scheduledTime: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', example: '09:00' },
            duration: { type: 'number', example: 1.5 },
            location: { type: 'string', example: 'Auto-école Centre' },
            notes: { type: 'string', example: 'Premier cours de conduite' }
          }
        },
        UpdateSessionStatus: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['présent', 'absent', 'en_retard', 'annulé'], example: 'absent' },
            notes: { type: 'string', example: 'Élève excusé pour maladie' },
            actualStartTime: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', example: '09:15' },
            actualEndTime: { type: 'string', pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$', example: '10:30' }
          }
        },
        SessionDetails: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'session123' },
            student: { $ref: '#/components/schemas/UserProfile' },
            instructor: { $ref: '#/components/schemas/UserProfile' },
            courseType: { type: 'string', enum: ['code', 'conduite', 'autoroute', 'examen_blanc'], example: 'conduite' },
            courseTitle: { type: 'string', example: 'Conduite pratique' },
            scheduledDate: { type: 'string', format: 'date-time' },
            scheduledTime: { type: 'string', example: '09:00' },
            actualStartTime: { type: 'string', example: '09:15' },
            actualEndTime: { type: 'string', example: '10:30' },
            duration: { type: 'number', example: 1.5 },
            status: { type: 'string', enum: ['présent', 'absent', 'en_retard', 'annulé'], example: 'présent' },
            notes: { type: 'string', example: 'Très bon cours' },
            location: { type: 'string', example: 'Auto-école Centre' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        SessionFilters: {
          type: 'object',
          properties: {
            date: { type: 'string', format: 'date', example: '2024-01-15' },
            instructorId: { type: 'string', example: 'instructor123' },
            status: { type: 'string', enum: ['présent', 'absent', 'en_retard', 'annulé'], example: 'présent' },
            studentId: { type: 'string', example: 'student123' },
            courseType: { type: 'string', enum: ['code', 'conduite', 'autoroute', 'examen_blanc'], example: 'conduite' },
            startDate: { type: 'string', format: 'date', example: '2024-01-01' },
            endDate: { type: 'string', format: 'date', example: '2024-01-31' }
          }
        },
        RegistrationData: {
          type: 'object',
          required: ['nomComplet', 'email', 'telephone', 'adresse', 'dateNaissance', 'dateDebut', 'heurePreferee', 'formation'],
          properties: {
            nomComplet: { type: 'string', example: 'Jean Dupont', description: 'Nom complet de l\'étudiant' },
            email: { type: 'string', format: 'email', example: 'jean.dupont@email.com', description: 'Adresse email de l\'étudiant' },
            telephone: { type: 'string', example: '0123456789', description: 'Numéro de téléphone' },
            adresse: { type: 'string', example: '123 Rue de la Paix, 75001 Paris', description: 'Adresse complète' },
            dateNaissance: { type: 'string', format: 'date', example: '1990-05-15', description: 'Date de naissance' },
            dateDebut: { type: 'string', format: 'date', example: '2024-02-15', description: 'Date de début souhaitée' },
            heurePreferee: { type: 'string', example: '14:00', description: 'Heure préférée' },
            formation: { type: 'string', example: 'Permis B - Formation complète', description: 'Type de formation' }
          }
        },
        RegistrationResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Inscription enregistrée avec succès' },
            registrationId: { type: 'string', example: 'reg_123456789' },
            emailsSent: {
              type: 'object',
              properties: {
                student: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    messageId: { type: 'string', example: 'email_123' }
                  }
                },
                admin: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    messageId: { type: 'string', example: 'email_456' }
                  }
                }
              }
            },
            registration: {
              type: 'object',
              properties: {
                id: { type: 'string', example: 'reg_123456789' },
                nomComplet: { type: 'string', example: 'Jean Dupont' },
                email: { type: 'string', example: 'jean.dupont@email.com' },
                dateDebut: { type: 'string', example: '2024-02-15' },
                heurePreferee: { type: 'string', example: '14:00' },
                formation: { type: 'string', example: 'Permis B - Formation complète' },
                createdAt: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        NewsArticle: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'abc123def456',
              description: 'ID unique de l\'actualité'
            },
            title: {
              type: 'string',
              example: 'Nouvelle réglementation du code de la route 2024',
              description: 'Titre de l\'actualité'
            },
            excerpt: {
              type: 'string',
              example: 'Les nouvelles règles du code de la route entrent en vigueur ce mois-ci.',
              description: 'Extrait de l\'actualité'
            },
            content: {
              type: 'string',
              example: 'Le contenu complet de l\'actualité avec formatage HTML...',
              description: 'Contenu principal de l\'actualité'
            },
            category: {
              type: 'string',
              enum: ['actualites', 'reglementation', 'promotions', 'conseils', 'technique', 'nouveau-centre'],
              example: 'reglementation',
              description: 'Catégorie de l\'actualité'
            },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'scheduled'],
              example: 'published',
              description: 'Statut de publication'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              example: ['permis', 'code', 'formation'],
              description: 'Tags associés à l\'actualité'
            },
            allowComments: {
              type: 'boolean',
              example: true,
              description: 'Permettre les commentaires'
            },
            pinToTop: {
              type: 'boolean',
              example: false,
              description: 'Épingler en haut de la liste'
            },
            authorId: {
              type: 'string',
              example: 'abc123def456',
              description: 'ID de l\'auteur'
            },
            authorName: {
              type: 'string',
              example: 'Jean Martin',
              description: 'Nom de l\'auteur'
            },
            views: {
              type: 'number',
              example: 245,
              description: 'Nombre de vues'
            },
            imageUrl: {
              type: 'string',
              nullable: true,
              example: 'https://storage.googleapis.com/bucket/image.jpg',
              description: 'URL de l\'image principale'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-20T10:30:00.000Z',
              description: 'Date de création'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-20T10:30:00.000Z',
              description: 'Date de dernière modification'
            },
            publishedAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-20T10:30:00.000Z',
              description: 'Date de publication'
            },
            scheduledAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2024-01-25T10:30:00.000Z',
              description: 'Date de publication programmée'
            }
          }
        },
        NewsStats: {
          type: 'object',
          properties: {
            totalArticles: {
              type: 'number',
              example: 5,
              description: 'Nombre total d\'articles ce mois'
            },
            publishedArticles: {
              type: 'number',
              example: 3,
              description: 'Nombre d\'articles publiés'
            },
            draftArticles: {
              type: 'number',
              example: 1,
              description: 'Nombre d\'articles en brouillon'
            },
            scheduledArticles: {
              type: 'number',
              example: 1,
              description: 'Nombre d\'articles programmés'
            },
            totalViews: {
              type: 'number',
              example: 869,
              description: 'Nombre total de vues ce mois'
            }
          }
        },
        NewsPagination: {
          type: 'object',
          properties: {
            page: {
              type: 'number',
              example: 1,
              description: 'Numéro de page actuel'
            },
            limit: {
              type: 'number',
              example: 10,
              description: 'Nombre d\'articles par page'
            },
            total: {
              type: 'number',
              example: 25,
              description: 'Nombre total d\'articles'
            },
            totalPages: {
              type: 'number',
              example: 3,
              description: 'Nombre total de pages'
            }
          }
        },
        UpcomingSession: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'session123',
              description: 'ID de la séance'
            },
            student: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: 'student123'
                },
                nom: {
                  type: 'string',
                  example: 'Marie Dubois'
                },
                email: {
                  type: 'string',
                  example: 'marie.dubois@email.com'
                },
                initials: {
                  type: 'string',
                  example: 'MD'
                }
              }
            },
            instructor: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  example: 'instructor123'
                },
                nom: {
                  type: 'string',
                  example: 'Jean Martin'
                }
              }
            },
            type: {
              type: 'string',
              enum: ['conduite', 'code', 'examen', 'évaluation', 'perfectionnement'],
              example: 'conduite',
              description: 'Type de séance'
            },
            date: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-20T09:00:00.000Z',
              description: 'Date de la séance'
            },
            time: {
              type: 'string',
              example: '09:00',
              description: 'Heure de la séance'
            },
            duration: {
              type: 'string',
              example: '1h30',
              description: 'Durée de la séance'
            },
            status: {
              type: 'string',
              enum: ['confirmée', 'en_attente', 'annulée'],
              example: 'confirmée',
              description: 'Statut de la séance'
            }
          }
        },
        SessionDashboardStats: {
          type: 'object',
          properties: {
            totalSessions: {
              type: 'number',
              example: 8,
              description: 'Nombre total de séances'
            },
            confirmedSessions: {
              type: 'number',
              example: 5,
              description: 'Nombre de séances confirmées'
            },
            pendingSessions: {
              type: 'number',
              example: 2,
              description: 'Nombre de séances en attente'
            },
            cancelledSessions: {
              type: 'number',
              example: 1,
              description: 'Nombre de séances annulées ce mois'
            },
            todaySessions: {
              type: 'number',
              example: 0,
              description: 'Nombre de séances aujourd\'hui'
            },
            thisWeekSessions: {
              type: 'number',
              example: 0,
              description: 'Nombre de séances cette semaine'
            }
          }
        },
        UpdateSession: {
          type: 'object',
          properties: {
            studentId: {
              type: 'string',
              example: 'student123',
              description: 'ID de l\'élève'
            },
            instructorId: {
              type: 'string',
              example: 'instructor123',
              description: 'ID de l\'instructeur'
            },
            courseType: {
              type: 'string',
              enum: ['conduite', 'code', 'examen', 'évaluation', 'perfectionnement'],
              example: 'conduite',
              description: 'Type de cours'
            },
            courseTitle: {
              type: 'string',
              example: 'Cours de conduite niveau 1',
              description: 'Titre du cours'
            },
            scheduledDate: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-20T09:00:00.000Z',
              description: 'Date programmée'
            },
            scheduledTime: {
              type: 'string',
              example: '09:00',
              description: 'Heure programmée'
            },
            duration: {
              type: 'string',
              example: '1h30',
              description: 'Durée de la séance'
            },
            status: {
              type: 'string',
              enum: ['confirmée', 'en_attente', 'annulée'],
              example: 'confirmée',
              description: 'Statut de la séance'
            },
            location: {
              type: 'string',
              example: 'Salle de cours A',
              description: 'Lieu de la séance'
            },
            notes: {
              type: 'string',
              example: 'Notes importantes',
              description: 'Notes sur la séance'
            }
          }
        },
        // Nouveaux schémas pour les pages de profil
        UserSession: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'session123' },
            title: { type: 'string', example: 'Code de la route - Signalisation' },
            instructorName: { type: 'string', example: 'Marie Dubois' },
            date: { type: 'string', example: 'lundi 15 janvier' },
            time: { type: 'string', example: '14:00' },
            duration: { type: 'string', example: '2h' },
            type: { type: 'string', enum: ['Théorique', 'Pratique', 'En ligne'], example: 'Théorique' },
            status: { type: 'string', enum: ['Terminé', 'À venir', 'En cours', 'Absent'], example: 'Terminé' },
            iconType: { type: 'string', enum: ['book', 'car', 'monitor'], example: 'book' }
          }
        },
        UserSettings: {
          type: 'object',
          properties: {
            security: {
              type: 'object',
              properties: {
                passwordLastModified: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
                twoFactorEnabled: { type: 'boolean', example: false }
              }
            },
            notifications: {
              type: 'object',
              properties: {
                sessionReminders: { type: 'boolean', example: true },
                newsUpdates: { type: 'boolean', example: false }
              }
            },
            profile: {
              type: 'object',
              properties: {
                email: { type: 'string', example: 'marie.dubois@email.com' },
                phone: { type: 'string', example: '06 12 34 56 78' },
                address: { type: 'string', example: '123 Rue de la Paix, 75001 Paris' }
              }
            }
          }
        },
        SupportTicket: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'TICKET_123456' },
            nomComplet: { type: 'string', example: 'Marie Dubois' },
            email: { type: 'string', format: 'email', example: 'marie.dubois@example.com' },
            telephone: { type: 'string', example: '06 12 34 56 78' },
            sujet: { type: 'string', example: 'Question sur mon inscription' },
            priorite: { type: 'string', enum: ['Faible', 'Normale', 'Élevée', 'Urgente'], example: 'Normale' },
            message: { type: 'string', example: 'Bonjour, j\'aimerais savoir...' },
            status: { type: 'string', enum: ['nouveau', 'en_cours', 'résolu', 'fermé'], example: 'nouveau' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        FAQItem: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'faq_001' },
            question: { type: 'string', example: 'Comment s\'inscrire à un cours de conduite ?' },
            reponse: { type: 'string', example: 'Pour vous inscrire, rendez-vous sur notre site web...' },
            category: { type: 'string', enum: ['inscription', 'cours', 'paiement', 'technique'], example: 'inscription' },
            order: { type: 'number', example: 1 }
          }
        },
        ContactInfo: {
          type: 'object',
          properties: {
            contact: {
              type: 'object',
              properties: {
                telephone: {
                  type: 'object',
                  properties: {
                    number: { type: 'string', example: '01 23 45 67 89' },
                    hours: { type: 'string', example: 'Lundi - Vendredi : 8h00 - 18h00' }
                  }
                },
                email: {
                  type: 'object',
                  properties: {
                    address: { type: 'string', example: 'support@auto-ecole.fr' },
                    responseTime: { type: 'string', example: 'Réponse sous 24h' }
                  }
                },
                address: {
                  type: 'object',
                  properties: {
                    location: { type: 'string', example: '123 Rue de la Paix, 75001 Paris' },
                    hours: { type: 'string', example: 'Lun-Ven: 8h-18h, Sam: 9h-16h' }
                  }
                }
              }
            }
          }
        },
        // Nouveaux schémas pour l'API d'inscription améliorée
        RegistrationWithRole: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'reg_123456789' },
            nomComplet: { type: 'string', example: 'Jean Dupont' },
            email: { type: 'string', format: 'email', example: 'jean.dupont@email.com' },
            telephone: { type: 'string', example: '0123456789' },
            dateDebut: { type: 'string', format: 'date', example: '2024-02-15' },
            heurePreferee: { type: 'string', example: '14:00' },
            formation: { type: 'string', example: 'Permis B - Formation complète' },
            status: { type: 'string', enum: ['pending', 'confirmed', 'cancelled'], example: 'pending' },
            createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
            userRole: {
              type: 'object',
              nullable: true,
              properties: {
                uid: { type: 'string', example: 'user123' },
                role: { type: 'string', enum: ['admin', 'instructeur', 'eleve'], example: 'eleve' },
                statut: { type: 'string', example: 'actif' },
                isFirstLogin: { type: 'boolean', example: false },
                createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' }
              }
            }
          }
        },
        UserInfo: {
          type: 'object',
          properties: {
            uid: { type: 'string', example: 'user123' },
            role: { type: 'string', enum: ['admin', 'instructeur', 'eleve'], example: 'eleve' },
            statut: { type: 'string', example: 'actif' },
            isFirstLogin: { type: 'boolean', example: false },
            theoreticalHours: { type: 'number', example: 15 },
            practicalHours: { type: 'number', example: 8 },
            licenseType: { type: 'string', example: 'B' },
            createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' }
          }
        }
      }
    },
  },
  apis: ['./routes/*.js'], // Chemin vers les fichiers contenant les annotations Swagger
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ✅ Test route
app.get("/", (req, res) => {
  res.send("API Auto École fonctionne !");
});

// ✅ Health check endpoint pour keep-alive
app.get("/health", (req, res) => {
  res.status(200).json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ✅ Ping endpoint (alternative)
app.get("/ping", (req, res) => {
  res.status(200).send("pong");
});

// ✅ Routes principales
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const newsRoutes = require("./routes/news");
app.use("/api/news", newsRoutes);

const usersRoutes = require("./routes/users");
app.use("/api/users", usersRoutes);

const commentsRoutes = require("./routes/comments");
app.use("/api/comments", commentsRoutes);

const uploadRoute = require("./routes/upload");
app.use("/api/upload", uploadRoute);

const courseRoutes = require("./routes/courses");
app.use("/api/courses", courseRoutes);

const settingsRoutes = require("./routes/settings");
app.use("/api/settings", settingsRoutes);

const supportRoutes = require("./routes/support");
app.use("/api/support", supportRoutes);

const dashboardRoutes = require("./routes/dashboard");
app.use("/api/dashboard", dashboardRoutes);

const seedRoutes = require("./routes/seed");
app.use("/api/seed", seedRoutes);

const studentRoutes = require("./routes/student");
app.use("/api/student", studentRoutes);

const studentSeedRoutes = require("./routes/studentSeed");
app.use("/api/seed", studentSeedRoutes);

const studentProfileRoutes = require("./routes/studentProfile");
app.use("/api/student-profile", studentProfileRoutes);

const sessionsRoutes = require("./routes/sessions");
app.use("/api/sessions", sessionsRoutes);

const sessionSeedRoutes = require("./routes/sessionSeed");
app.use("/api/seed", sessionSeedRoutes);

const registrationRoutes = require("./routes/registration");
app.use("/api/registration", registrationRoutes);

// ✅ Middleware de gestion d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur:', err.stack);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Une erreur est survenue'
  });
});

// ✅ Middleware pour routes non trouvées
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// ✅ Lancement du serveur
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📚 Documentation Swagger disponible sur: http://localhost:${PORT}/api-docs`);
});
