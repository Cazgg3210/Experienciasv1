-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'OWNER', 'STAFF', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "Occasion" AS ENUM ('BIRTHDAY', 'FRIENDS_BRUNCH', 'BACHELORETTE', 'BRIDAL', 'BABY_BRUNCH', 'GATHERING', 'CORPORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "ExperienceType" AS ENUM ('BRUNCH', 'BREAKFAST', 'CELEBRATION', 'THEMED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'QUOTED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('CONFIGURATOR', 'AI_DESIGNER', 'CONTACT_FORM', 'WHATSAPP', 'INSTAGRAM', 'TIKTOK', 'REFERRAL', 'GOOGLE', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('CREATED', 'STATUS_CHANGE', 'NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'QUOTE_CREATED', 'QUOTE_SENT', 'ASSIGNED', 'SYSTEM');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "QuoteItemType" AS ENUM ('BASE_EXPERIENCE', 'EXTRA_GUEST', 'MENU', 'ADDON', 'LOGISTICS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('INQUIRY', 'PENDING_PAYMENT', 'CONFIRMED', 'PLANNING', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE', 'CASH', 'TRANSFER', 'CARD_TERMINAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MenuPricingType" AS ENUM ('INCLUDED', 'PER_GUEST', 'FLAT');

-- CreateEnum
CREATE TYPE "AddOnPricingType" AS ENUM ('FLAT', 'PER_GUEST');

-- CreateEnum
CREATE TYPE "AddOnCategory" AS ENUM ('DECOR', 'FOOD', 'DRINKS', 'ENTERTAINMENT', 'PHOTO', 'PERSONALIZATION', 'EXPERIENCE', 'OTHER');

-- CreateEnum
CREATE TYPE "MenuCourse" AS ENUM ('DRINK', 'STARTER', 'MAIN', 'SIDE', 'DESSERT', 'OTHER');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('FOOD', 'FLOWERS', 'STAFF', 'TRANSPORT', 'VENDOR', 'CONSUMABLES', 'PAYMENT_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'ATTENDING', 'NOT_ATTENDING', 'MAYBE');

-- CreateEnum
CREATE TYPE "GuestSource" AS ENUM ('HOST', 'ADMIN', 'SELF_RSVP');

-- CreateEnum
CREATE TYPE "DietaryRestriction" AS ENUM ('VEGETARIAN', 'VEGAN', 'GLUTEN_FREE', 'LACTOSE_FREE', 'NUT_ALLERGY', 'SEAFOOD_ALLERGY', 'KOSHER', 'HALAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('HOST_THREAD', 'HONOREE', 'GUESTBOOK');

-- CreateEnum
CREATE TYPE "MessageAuthorType" AS ENUM ('CUSTOMER', 'GUEST', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ChecklistPhase" AS ENUM ('T_MINUS_7', 'T_MINUS_3', 'T_MINUS_1', 'SETUP', 'EVENT', 'TEARDOWN', 'CLOSING');

-- CreateEnum
CREATE TYPE "ChecklistArea" AS ENUM ('FOOD', 'TABLE', 'FLOWERS', 'ADDONS', 'TRANSPORT', 'STAFF', 'CLIENT', 'ADMIN', 'GENERAL');

-- CreateEnum
CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "StaffFunction" AS ENUM ('COORDINATOR', 'CHEF', 'KITCHEN_ASSISTANT', 'SERVER', 'SETUP', 'DRIVER', 'HOST', 'PHOTOGRAPHER', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffRateType" AS ENUM ('PER_EVENT', 'PER_HOUR');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('DINNERWARE', 'GLASSWARE', 'CUTLERY', 'LINENS', 'DECOR', 'AUDIO', 'KARAOKE', 'FURNITURE', 'SERVING', 'OTHER');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE_IN', 'RESERVE', 'RELEASE', 'CHECK_OUT', 'RETURN', 'MAINTENANCE_OUT', 'MAINTENANCE_IN', 'LOSS', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InventoryReservationStatus" AS ENUM ('RESERVED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('FLOWERS', 'FOOD', 'PASTRY', 'TRANSPORT', 'FURNITURE', 'PHOTO', 'BEVERAGES', 'OTHER');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('REQUESTED', 'ORDERED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AvailabilityExceptionType" AS ENUM ('BLOCKED', 'BLACKOUT', 'CAPACITY_OVERRIDE');

-- CreateEnum
CREATE TYPE "StorageDriver" AS ENUM ('S3', 'LOCAL', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('EXPERIENCE', 'GALLERY', 'STYLE', 'ADDON', 'EVENT', 'MEMORY', 'RECEIPT', 'CHECKLIST_EVIDENCE', 'AVATAR', 'OTHER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAD_RECEIVED', 'QUOTE_SENT', 'QUOTE_EXPIRING', 'QUOTE_ACCEPTED', 'PAYMENT_DUE', 'PAYMENT_RECEIVED', 'BOOKING_CONFIRMED', 'RSVP_REMINDER', 'EVENT_7D', 'EVENT_48H', 'POST_EVENT', 'REVIEW_REQUEST', 'PORTAL_ACCESS', 'STAFF_ASSIGNED', 'GENERIC');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'MOCKED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('VIEW_EXPERIENCE', 'START_CONFIGURATOR', 'COMPLETE_CONFIGURATOR', 'SUBMIT_LEAD', 'VIEW_QUOTE', 'ACCEPT_QUOTE', 'START_PAYMENT', 'PAYMENT_SUCCESS', 'RSVP_SUBMIT', 'AI_DESIGN_GENERATED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "notes" TEXT,
    "source" "LeadSource" NOT NULL DEFAULT 'OTHER',
    "referralCode" TEXT NOT NULL,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRange" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minCents" INTEGER NOT NULL,
    "maxCents" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "occasion" "Occasion" NOT NULL DEFAULT 'OTHER',
    "occasionOther" TEXT,
    "eventDate" DATE,
    "guestCount" INTEGER,
    "budgetRangeId" TEXT,
    "budgetNotes" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" "LeadSource" NOT NULL DEFAULT 'CONFIGURATOR',
    "serviceAreaId" TEXT,
    "zoneText" TEXT,
    "outOfArea" BOOLEAN NOT NULL DEFAULT false,
    "specialRequest" BOOLEAN NOT NULL DEFAULT false,
    "experienceId" TEXT,
    "styleId" TEXT,
    "menuId" TEXT,
    "honoreeName" TEXT,
    "colors" TEXT[],
    "inspiration" TEXT,
    "notes" TEXT,
    "estimatedTotalCents" INTEGER,
    "referredByCode" TEXT,
    "utmSource" TEXT,
    "lostReason" TEXT,
    "assignedToId" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "message" TEXT,
    "fromStatus" "LeadStatus",
    "toStatus" "LeadStatus",
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationSnapshot" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "estimate" JSONB NOT NULL,
    "pricingVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigurationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Style" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "palette" TEXT[],
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Style_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "postalCodes" TEXT[],
    "logisticsFeeCents" INTEGER NOT NULL DEFAULT 0,
    "logisticsCostCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT NOT NULL,
    "type" "ExperienceType" NOT NULL DEFAULT 'BRUNCH',
    "occasions" "Occasion"[],
    "basePriceCents" INTEGER NOT NULL,
    "baseGuests" INTEGER NOT NULL DEFAULT 6,
    "minGuests" INTEGER NOT NULL DEFAULT 6,
    "maxGuests" INTEGER NOT NULL DEFAULT 12,
    "extraGuestPriceCents" INTEGER NOT NULL DEFAULT 0,
    "extraGuestCostCents" INTEGER NOT NULL DEFAULT 0,
    "durationMinutes" INTEGER NOT NULL DEFAULT 180,
    "includes" TEXT[],
    "coverImageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceCostComponent" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "perGuest" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExperienceCostComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceImage" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExperienceImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceInventoryRequirement" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "perGuest" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ExperienceInventoryRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Menu" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "pricingType" "MenuPricingType" NOT NULL DEFAULT 'INCLUDED',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "costPerGuestCents" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[],
    "dietaryTags" "DietaryRestriction"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Menu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "course" "MenuCourse" NOT NULL DEFAULT 'MAIN',
    "dietaryTags" "DietaryRestriction"[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOn" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" "AddOnCategory" NOT NULL DEFAULT 'OTHER',
    "pricingType" "AddOnPricingType" NOT NULL DEFAULT 'FLAT',
    "priceCents" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "costCategory" "CostCategory" NOT NULL DEFAULT 'VENDOR',
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddOnInventoryRequirement" (
    "id" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "perGuest" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AddOnInventoryRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityRule" (
    "id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "maxEvents" INTEGER NOT NULL DEFAULT 2,
    "earliestStart" TEXT NOT NULL DEFAULT '08:00',
    "latestEnd" TEXT NOT NULL DEFAULT '21:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityException" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "AvailabilityExceptionType" NOT NULL,
    "maxEvents" INTEGER,
    "reason" TEXT,
    "serviceAreaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "leadId" TEXT,
    "customerId" TEXT NOT NULL,
    "experienceId" TEXT,
    "menuId" TEXT,
    "styleId" TEXT,
    "serviceAreaId" TEXT,
    "occasion" "Occasion" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "eventDate" DATE,
    "startTime" TEXT,
    "guestCount" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountType" "DiscountType",
    "discountValue" INTEGER,
    "discountReason" TEXT,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "logisticsCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostCents" INTEGER NOT NULL DEFAULT 0,
    "estimatedMarginCents" INTEGER NOT NULL DEFAULT 0,
    "marginBps" INTEGER NOT NULL DEFAULT 0,
    "depositBps" INTEGER NOT NULL DEFAULT 5000,
    "depositCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "pricingSnapshot" JSONB,
    "notesForCustomer" TEXT,
    "internalNotes" TEXT,
    "validUntil" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiredAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "type" "QuoteItemType" NOT NULL,
    "refId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "unitCostCents" INTEGER NOT NULL DEFAULT 0,
    "totalPriceCents" INTEGER NOT NULL,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "costCategory" "CostCategory" NOT NULL DEFAULT 'OTHER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "depositRequiredCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "termsVersion" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "acceptedByName" TEXT NOT NULL,
    "acceptedIp" TEXT,
    "balanceDueAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "method" "PaymentMethod" NOT NULL DEFAULT 'ONLINE',
    "provider" TEXT NOT NULL,
    "providerCheckoutId" TEXT,
    "providerPaymentId" TEXT,
    "checkoutUrl" TEXT,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "idempotencyKey" TEXT NOT NULL,
    "refundOfId" TEXT,
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "notes" TEXT,
    "recordedById" TEXT,
    "receiptMediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'INQUIRY',
    "customerId" TEXT NOT NULL,
    "quoteId" TEXT,
    "experienceId" TEXT,
    "menuId" TEXT,
    "styleId" TEXT,
    "serviceAreaId" TEXT,
    "occasion" "Occasion" NOT NULL DEFAULT 'OTHER',
    "honoreeName" TEXT,
    "eventDate" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "addressLine" TEXT,
    "addressNotes" TEXT,
    "neighborhood" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Ciudad de México',
    "postalCode" TEXT,
    "mapsUrl" TEXT,
    "colors" TEXT[],
    "inspiration" TEXT,
    "dressCode" TEXT,
    "hostMessage" TEXT,
    "playlistUrl" TEXT,
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "micrositeSlug" TEXT NOT NULL,
    "micrositeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inviteToken" TEXT NOT NULL,
    "portalToken" TEXT NOT NULL,
    "departureAt" TIMESTAMP(3),
    "setupStartsAt" TIMESTAMP(3),
    "teardownAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "closingSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAddOn" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceCents" INTEGER NOT NULL,
    "costCents" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "EventAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventGuest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "token" TEXT NOT NULL,
    "rsvpStatus" "RsvpStatus" NOT NULL DEFAULT 'PENDING',
    "plusOne" BOOLEAN NOT NULL DEFAULT false,
    "plusOneName" TEXT,
    "dietaryRestrictions" "DietaryRestriction"[],
    "dietaryNotes" TEXT,
    "comment" TEXT,
    "source" "GuestSource" NOT NULL DEFAULT 'HOST',
    "photoConsent" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),
    "invitedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMessage" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "authorType" "MessageAuthorType" NOT NULL,
    "authorName" TEXT NOT NULL,
    "guestId" TEXT,
    "body" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTimelineItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibleToGuests" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventTimelineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" "ChecklistPhase" NOT NULL,
    "description" TEXT,
    "experienceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "area" "ChecklistArea" NOT NULL DEFAULT 'GENERAL',
    "offsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "defaultFunction" "StaffFunction",
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventChecklistItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "templateItemId" TEXT,
    "phase" "ChecklistPhase" NOT NULL,
    "area" "ChecklistArea" NOT NULL DEFAULT 'GENERAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "assigneeId" TEXT,
    "dueAt" TIMESTAMP(3),
    "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
    "evidenceMediaId" TEXT,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "primaryFunction" "StaffFunction" NOT NULL DEFAULT 'SERVER',
    "phone" TEXT,
    "email" TEXT,
    "rateCents" INTEGER NOT NULL DEFAULT 0,
    "rateType" "StaffRateType" NOT NULL DEFAULT 'PER_EVENT',
    "availableWeekdays" INTEGER[],
    "availabilityNotes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAssignment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "function" "StaffFunction" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pz',
    "totalQuantity" INTEGER NOT NULL,
    "maintenanceQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 0,
    "replacementCostCents" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'RESERVED',
    "returnedQuantity" INTEGER,
    "damagedQuantity" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "eventId" TEXT,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "actorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "slaNotes" TEXT,
    "notes" TEXT,
    "status" "VendorStatus" NOT NULL DEFAULT 'ACTIVE',
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "vendorId" TEXT,
    "concept" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL DEFAULT 'VENDOR',
    "expectedAmountCents" INTEGER NOT NULL,
    "actualAmountCents" INTEGER,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'REQUESTED',
    "neededBy" TIMESTAMP(3),
    "orderedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "receiptMediaId" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCost" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "category" "CostCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "driver" "StorageDriver" NOT NULL,
    "storageKey" TEXT,
    "url" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "alt" TEXT,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE',
    "purpose" "MediaPurpose" NOT NULL DEFAULT 'OTHER',
    "eventId" TEXT,
    "memoryCapsuleId" TEXT,
    "guestId" TEXT,
    "uploaderName" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryCapsule" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "shareToken" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "allowGuestUploads" BOOLEAN NOT NULL DEFAULT true,
    "coverMediaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryCapsule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "occasion" TEXT,
    "body" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faq" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "experienceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "npsScore" INTEGER,
    "comment" TEXT,
    "publishable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiDesign" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "promptVersion" TEXT NOT NULL,
    "prompt" TEXT,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "dedupeKey" TEXT,
    "leadId" TEXT,
    "quoteId" TEXT,
    "eventId" TEXT,
    "providerMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "sessionId" TEXT,
    "path" TEXT,
    "experienceId" TEXT,
    "leadId" TEXT,
    "quoteId" TEXT,
    "eventId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "_ExperienceToStyle" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExperienceToStyle_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ExperienceToServiceArea" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExperienceToServiceArea_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ExperienceToMenu" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ExperienceToMenu_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_AddOnToExperience" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AddOnToExperience_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_referralCode_key" ON "Customer"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_code_key" ON "Lead"("code");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_eventDate_idx" ON "Lead"("eventDate");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationSnapshot_leadId_key" ON "ConfigurationSnapshot"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "Style_slug_key" ON "Style"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceArea_slug_key" ON "ServiceArea"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Experience_slug_key" ON "Experience"("slug");

-- CreateIndex
CREATE INDEX "Experience_active_sortOrder_idx" ON "Experience"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "ExperienceCostComponent_experienceId_idx" ON "ExperienceCostComponent"("experienceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceImage_experienceId_mediaAssetId_key" ON "ExperienceImage"("experienceId", "mediaAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "ExperienceInventoryRequirement_experienceId_inventoryItemId_key" ON "ExperienceInventoryRequirement"("experienceId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Menu_slug_key" ON "Menu"("slug");

-- CreateIndex
CREATE INDEX "MenuItem_menuId_idx" ON "MenuItem"("menuId");

-- CreateIndex
CREATE UNIQUE INDEX "AddOn_slug_key" ON "AddOn"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AddOnInventoryRequirement_addOnId_inventoryItemId_key" ON "AddOnInventoryRequirement"("addOnId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityRule_weekday_key" ON "AvailabilityRule"("weekday");

-- CreateIndex
CREATE INDEX "AvailabilityException_date_idx" ON "AvailabilityException"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_code_key" ON "Quote"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_publicToken_key" ON "Quote"("publicToken");

-- CreateIndex
CREATE INDEX "Quote_status_createdAt_idx" ON "Quote"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE INDEX "Quote_leadId_idx" ON "Quote"("leadId");

-- CreateIndex
CREATE INDEX "Quote_validUntil_idx" ON "Quote"("validUntil");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_code_key" ON "Booking"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_quoteId_key" ON "Booking"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_eventId_key" ON "Booking"("eventId");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_bookingId_status_idx" ON "Payment"("bookingId", "status");

-- CreateIndex
CREATE INDEX "Payment_providerPaymentId_idx" ON "Payment"("providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerCheckoutId_key" ON "Payment"("provider", "providerCheckoutId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_externalId_key" ON "WebhookEvent"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_code_key" ON "Event"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Event_quoteId_key" ON "Event"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_micrositeSlug_key" ON "Event"("micrositeSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Event_inviteToken_key" ON "Event"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "Event_portalToken_key" ON "Event"("portalToken");

-- CreateIndex
CREATE INDEX "Event_eventDate_status_idx" ON "Event"("eventDate", "status");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_customerId_idx" ON "Event"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAddOn_eventId_addOnId_key" ON "EventAddOn"("eventId", "addOnId");

-- CreateIndex
CREATE UNIQUE INDEX "EventGuest_token_key" ON "EventGuest"("token");

-- CreateIndex
CREATE INDEX "EventGuest_eventId_rsvpStatus_idx" ON "EventGuest"("eventId", "rsvpStatus");

-- CreateIndex
CREATE INDEX "EventMessage_eventId_kind_createdAt_idx" ON "EventMessage"("eventId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "EventTimelineItem_eventId_sortOrder_idx" ON "EventTimelineItem"("eventId", "sortOrder");

-- CreateIndex
CREATE INDEX "ChecklistTemplateItem_templateId_idx" ON "ChecklistTemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "EventChecklistItem_eventId_phase_idx" ON "EventChecklistItem"("eventId", "phase");

-- CreateIndex
CREATE INDEX "EventChecklistItem_assigneeId_status_idx" ON "EventChecklistItem"("assigneeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_userId_key" ON "StaffMember"("userId");

-- CreateIndex
CREATE INDEX "StaffAssignment_staffMemberId_startsAt_idx" ON "StaffAssignment"("staffMemberId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAssignment_eventId_staffMemberId_function_key" ON "StaffAssignment"("eventId", "staffMemberId", "function");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "InventoryReservation_eventId_idx" ON "InventoryReservation"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReservation_inventoryItemId_eventId_key" ON "InventoryReservation"("inventoryItemId", "eventId");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryItemId_createdAt_idx" ON "InventoryMovement"("inventoryItemId", "createdAt");

-- CreateIndex
CREATE INDEX "Vendor_category_status_idx" ON "Vendor"("category", "status");

-- CreateIndex
CREATE INDEX "Purchase_eventId_status_idx" ON "Purchase"("eventId", "status");

-- CreateIndex
CREATE INDEX "Purchase_vendorId_idx" ON "Purchase"("vendorId");

-- CreateIndex
CREATE INDEX "EventCost_eventId_idx" ON "EventCost"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");

-- CreateIndex
CREATE INDEX "MediaAsset_purpose_visibility_idx" ON "MediaAsset"("purpose", "visibility");

-- CreateIndex
CREATE INDEX "MediaAsset_eventId_idx" ON "MediaAsset"("eventId");

-- CreateIndex
CREATE INDEX "MediaAsset_memoryCapsuleId_idx" ON "MediaAsset"("memoryCapsuleId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryCapsule_eventId_key" ON "MemoryCapsule"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "MemoryCapsule_shareToken_key" ON "MemoryCapsule"("shareToken");

-- CreateIndex
CREATE INDEX "Faq_experienceId_active_idx" ON "Faq"("experienceId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Review_eventId_key" ON "Review"("eventId");

-- CreateIndex
CREATE INDEX "AiDesign_createdAt_idx" ON "AiDesign"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLog_eventId_idx" ON "NotificationLog"("eventId");

-- CreateIndex
CREATE INDEX "NotificationLog_type_status_idx" ON "NotificationLog"("type", "status");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "_ExperienceToStyle_B_index" ON "_ExperienceToStyle"("B");

-- CreateIndex
CREATE INDEX "_ExperienceToServiceArea_B_index" ON "_ExperienceToServiceArea"("B");

-- CreateIndex
CREATE INDEX "_ExperienceToMenu_B_index" ON "_ExperienceToMenu"("B");

-- CreateIndex
CREATE INDEX "_AddOnToExperience_B_index" ON "_AddOnToExperience"("B");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_budgetRangeId_fkey" FOREIGN KEY ("budgetRangeId") REFERENCES "BudgetRange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "ServiceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationSnapshot" ADD CONSTRAINT "ConfigurationSnapshot_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceCostComponent" ADD CONSTRAINT "ExperienceCostComponent_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceImage" ADD CONSTRAINT "ExperienceImage_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceImage" ADD CONSTRAINT "ExperienceImage_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceInventoryRequirement" ADD CONSTRAINT "ExperienceInventoryRequirement_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceInventoryRequirement" ADD CONSTRAINT "ExperienceInventoryRequirement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOnInventoryRequirement" ADD CONSTRAINT "AddOnInventoryRequirement_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AddOnInventoryRequirement" ADD CONSTRAINT "AddOnInventoryRequirement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "ServiceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receiptMediaId_fkey" FOREIGN KEY ("receiptMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_styleId_fkey" FOREIGN KEY ("styleId") REFERENCES "Style"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_serviceAreaId_fkey" FOREIGN KEY ("serviceAreaId") REFERENCES "ServiceArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddOn" ADD CONSTRAINT "EventAddOn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAddOn" ADD CONSTRAINT "EventAddOn_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "AddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventGuest" ADD CONSTRAINT "EventGuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMessage" ADD CONSTRAINT "EventMessage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMessage" ADD CONSTRAINT "EventMessage_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "EventGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTimelineItem" ADD CONSTRAINT "EventTimelineItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChecklistItem" ADD CONSTRAINT "EventChecklistItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChecklistItem" ADD CONSTRAINT "EventChecklistItem_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "ChecklistTemplateItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChecklistItem" ADD CONSTRAINT "EventChecklistItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChecklistItem" ADD CONSTRAINT "EventChecklistItem_evidenceMediaId_fkey" FOREIGN KEY ("evidenceMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChecklistItem" ADD CONSTRAINT "EventChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAssignment" ADD CONSTRAINT "StaffAssignment_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_receiptMediaId_fkey" FOREIGN KEY ("receiptMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCost" ADD CONSTRAINT "EventCost_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCost" ADD CONSTRAINT "EventCost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_memoryCapsuleId_fkey" FOREIGN KEY ("memoryCapsuleId") REFERENCES "MemoryCapsule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "EventGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryCapsule" ADD CONSTRAINT "MemoryCapsule_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryCapsule" ADD CONSTRAINT "MemoryCapsule_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Faq" ADD CONSTRAINT "Faq_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiDesign" ADD CONSTRAINT "AiDesign_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExperienceToStyle" ADD CONSTRAINT "_ExperienceToStyle_A_fkey" FOREIGN KEY ("A") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExperienceToStyle" ADD CONSTRAINT "_ExperienceToStyle_B_fkey" FOREIGN KEY ("B") REFERENCES "Style"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExperienceToServiceArea" ADD CONSTRAINT "_ExperienceToServiceArea_A_fkey" FOREIGN KEY ("A") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExperienceToServiceArea" ADD CONSTRAINT "_ExperienceToServiceArea_B_fkey" FOREIGN KEY ("B") REFERENCES "ServiceArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExperienceToMenu" ADD CONSTRAINT "_ExperienceToMenu_A_fkey" FOREIGN KEY ("A") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExperienceToMenu" ADD CONSTRAINT "_ExperienceToMenu_B_fkey" FOREIGN KEY ("B") REFERENCES "Menu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AddOnToExperience" ADD CONSTRAINT "_AddOnToExperience_A_fkey" FOREIGN KEY ("A") REFERENCES "AddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AddOnToExperience" ADD CONSTRAINT "_AddOnToExperience_B_fkey" FOREIGN KEY ("B") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
