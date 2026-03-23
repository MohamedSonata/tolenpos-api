# Implementation Plan: License Management System

## Overview

This plan implements a secure license management system for Strapi by extending the existing license API with custom controllers, services, and routes. The implementation follows Strapi's Document Service API patterns and includes encryption utilities for secure license key generation, comprehensive validation, and a custom activation endpoint.

## Tasks

- [x] 1. Set up encryption utility and environment configuration
  - [x] 1.1 Create encryption utility module with AES-256-GCM implementation
    - Implement `generateLicenseKey()` function that encrypts license metadata
    - Implement `decryptLicenseKey()` function for key validation
    - Implement `getEncryptionKey()` function to read from environment
    - Use Node.js crypto module with random IV generation
    - Include authentication tag for integrity verification
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.1_
  
  - [ ]* 1.2 Write property test for encryption round-trip consistency
    - **Property 1: License Creation Generates Encrypted Key with Metadata**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.8**
  
  - [ ]* 1.3 Write unit tests for encryption utility
    - Test successful encryption/decryption with valid key
    - Test error handling when ENCRYPTION_KEY is missing
    - Test encrypted output is non-deterministic (different IVs)
    - _Requirements: 1.6, 1.7, 5.2, 5.3_
  
  - [x] 1.4 Update .env.example with ENCRYPTION_KEY documentation
    - Add ENCRYPTION_KEY variable with description
    - Include example format and security notes
    - _Requirements: 5.4_

- [x] 2. Implement custom license service with validation
  - [x] 2.1 Create custom license service extending core service
    - Extend `factories.createCoreService('api::license.license')`
    - Override `create` method with custom validation logic
    - Import encryption utility for key generation
    - _Requirements: 2.1, 4.1, 4.2_
  
  - [x] 2.2 Implement license creation validation logic
    - Validate required fields (expirationType, maxSeats, user)
    - Validate expirationType is 'perpetual' or 'expiring'
    - Validate expireAt is provided and future for expiring licenses
    - Validate maxSeats is positive integer
    - Validate user reference exists
    - Return descriptive error messages for validation failures
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.10, 6.1, 6.6, 6.7_
  
  - [ ]* 2.3 Write property test for required fields validation
    - **Property 2: Required Fields Validation**
    - **Validates: Requirements 2.2, 6.7**
  
  - [ ]* 2.4 Write property test for expiration type validation
    - **Property 3: Expiration Type Validation**
    - **Validates: Requirements 2.3**
  
  - [ ]* 2.5 Write property test for conditional expiration date validation
    - **Property 4: Conditional Expiration Date Validation**
    - **Validates: Requirements 2.4**
  
  - [ ]* 2.6 Write property test for positive seats validation
    - **Property 5: Positive Seats Validation**
    - **Validates: Requirements 2.5**
  
  - [x] 2.7 Implement license key generation and default values
    - Generate license key using encryption utility after validation
    - Set isActive to false by default
    - Call super.create() with validated data and generated key
    - Handle encryption errors and return appropriate error response
    - _Requirements: 2.7, 2.8, 2.9, 4.3, 4.4, 5.1, 5.2, 5.3_
  
  - [ ]* 2.8 Write property test for user association
    - **Property 6: User Association**
    - **Validates: Requirements 2.6**
  
  - [ ]* 2.9 Write property test for default inactive status
    - **Property 7: Default Inactive Status**
    - **Validates: Requirements 2.7**
  
  - [ ]* 2.10 Write property test for validation error messages
    - **Property 8: Validation Errors Return Descriptive Messages**
    - **Validates: Requirements 2.10, 6.1**
  
  - [ ]* 2.11 Write unit tests for license service
    - Test successful license creation with perpetual type
    - Test successful license creation with expiring type
    - Test error when ENCRYPTION_KEY is missing
    - Test error when required fields are missing
    - Test error when maxSeats is zero or negative
    - Test error when expireAt is missing for expiring license
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.10, 5.2, 5.3_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement custom license controller with activation endpoint
  - [x] 4.1 Create custom license controller extending core controller
    - Extend `factories.createCoreController('api::license.license')`
    - Import license service for data operations
    - Set up error handling wrapper for all methods
    - _Requirements: 3.2, 4.5, 6.3_
  
  - [x] 4.2 Implement activate controller method
    - Extract licenseKey from request body
    - Query license by licenseKey using Document Service API
    - Validate license exists (return 404 if not found)
    - Validate license belongs to authenticated user (return 403 if not)
    - Validate license not expired for expiring type (return 400 if expired)
    - Validate license not already active (return 409 if already active)
    - Update isActive to true using service
    - Return success response with activation details
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_
  
  - [ ]* 4.3 Write property test for activation ownership validation
    - **Property 9: Activation Validates Ownership**
    - **Validates: Requirements 3.4, 3.10**
  
  - [ ]* 4.4 Write property test for activation expiration validation
    - **Property 10: Activation Validates Expiration**
    - **Validates: Requirements 3.5, 3.11**
  
  - [ ]* 4.5 Write property test for activation already-active validation
    - **Property 11: Activation Validates Not Already Active**
    - **Validates: Requirements 3.6, 3.12**
  
  - [ ]* 4.6 Write property test for activation key existence validation
    - **Property 12: Activation Validates Key Exists**
    - **Validates: Requirements 3.3, 3.9**
  
  - [ ]* 4.7 Write property test for successful activation
    - **Property 13: Successful Activation Sets Active Status**
    - **Validates: Requirements 3.7, 3.8**
  
  - [x] 4.8 Implement comprehensive error handling in controller
    - Wrap all controller methods in try-catch blocks
    - Map service errors to appropriate HTTP status codes
    - Log errors with context (user, request ID, timestamp)
    - Return user-friendly error messages without exposing internals
    - Return 500 for unexpected exceptions
    - _Requirements: 6.2, 6.3, 6.4, 6.5_
  
  - [ ]* 4.9 Write property test for exception handling
    - **Property 14: Exception Handling Returns 500**
    - **Validates: Requirements 6.5**
  
  - [ ]* 4.10 Write property test for validation error status codes
    - **Property 15: Validation Errors Return Appropriate Status Codes**
    - **Validates: Requirements 6.2**
  
  - [ ]* 4.11 Write property test for type validation
    - **Property 16: Type Validation**
    - **Validates: Requirements 6.6**
  
  - [ ]* 4.12 Write unit tests for license controller
    - Test successful activation with valid license key
    - Test 404 error when license key doesn't exist
    - Test 403 error when license belongs to different user
    - Test 400 error when license is expired
    - Test 409 error when license is already active
    - Test 500 error handling for unexpected exceptions
    - _Requirements: 3.9, 3.10, 3.11, 3.12, 6.5_

- [x] 5. Implement custom license router with activation route
  - [x] 5.1 Create custom license router extending core router
    - Extend `factories.createCoreRouter('api::license.license')`
    - Define custom routes array alongside core routes
    - _Requirements: 3.1, 4.6, 4.7_
  
  - [x] 5.2 Add custom activation route configuration
    - Add POST route at `/api/licenses/activate`
    - Map route to `license.activate` controller method
    - Configure authentication policies for the route
    - _Requirements: 3.1_
  
  - [ ]* 5.3 Write integration tests for activation endpoint
    - Test POST /api/licenses/activate with valid license key
    - Test POST /api/licenses/activate with invalid license key
    - Test POST /api/licenses/activate without authentication
    - Test POST /api/licenses/activate with expired license
    - Test POST /api/licenses/activate with already-active license
    - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.6, 3.9, 3.10, 3.11, 3.12_

- [ ] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check library
- Unit tests validate specific examples and edge cases
- All custom code extends Strapi factories to maintain compatibility
- Refer to Strapi documentation links in design document during implementation
- Encryption uses AES-256-GCM with random IVs for security
- All validation errors return descriptive messages with appropriate HTTP status codes
