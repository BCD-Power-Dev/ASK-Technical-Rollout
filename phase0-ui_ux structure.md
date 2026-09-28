# Tooljet UI/UX Application Development
Development is centered around the migration of content and function existing in SharePoint PowerApps into the ToolJet UI/UX platform. Many of the custom functions in PowerApps will be supported in ToolJet using custom REACT custom components. The breakdown of the complete migration schedule is listed below with associated deliverables.

## Phase 1 - Account Tool
  
### Account Selection Module
  - [X] GCN: GCN select > SMID select > LCN select
  - [X] SMID: Dynamic search
  - [X] LCN: Dynamic earch
  - [X] Saved Favorites (**Could be depreciated with country of service variable)
  
### Summary
  - [X] SMID/LCN Profile
  - [X] PCC/OID Results
  - [X] Form of Payment
  - [X] Account Status (Date determination)
  - [X] Contact Details (BCD/Account)
  - [X] Operational Hours
    
### Policy (Multi Tab UI)
#### General
##### <mark>General (Custom REACT component)</mark>
General migrates the existing SP Technology DB. Topics Are relational to SMID/LCN and have unique category and time duration constraints(optional). Topics can be free text searched or by catagory.
  - [X] General Topics [jsx](general_topics.jsx)
    - [X] Add
    - [X] Edit

***Related Tables***
> general_topics,ref_travel_categories,smid,lcn

##### <mark>Passport/Visa (Custom REACT component)</mark>
Vendor identification (passport_visa_vendors)
  - [X] Passport/Visa [jsx](passport_visa.jsx)
    - [X] Add
    - [X] Edit
    - [X] passport_visa_vendors
    
***Related Tables***
> passport_visa_vendors,smid,lcn

##### <mark>Country/Security Risks (Custom REACT component)</mark>
Vendor identification (passport_visa_vendors)
  - [X] Country/Security Risks [jsx](country_security_risk.jsx)
    - [X] Add
    - [X] Edit
    - [X] Country Select
    
***Related Tables***
> country_topics,smid,lcn,country

##### <mark>Travel Bookers (Custom REACT component)</mark>
Travel booker component creates a relational db that associates authorized travel bookers with account contacts. Record identifies service levels, alternate contacts and validation per unique travel booker based on expanded schema validation in records
  - [X] Travel Bookers [jsx](travel_bookers.jsx)
    - [X] Add
    - [X] Edit
    - [X] Add new Employee
    
***Related Tables***
> travel_bookers,account_employee_list,smid,lcn

##### <mark>OBT Topics (Custom REACT component)</mark>
  - [X] OBT Topics [jsx](obt.jsx)
    - [X] Add
    - [X] Edit
    - [X] OBT reference
    
***Related Tables***
> obt_topic,obt,smid,lcn

##### <mark>Reportable Fields</mark>
  - [X] Reportable Fields

> [!WARNING]
> This section is currently using tooljet components and needs updating
    
***Related Tables***
> reportable_fields

##### <mark>FOP (ALL) (Custom REACT component)</mark>
Form of payment (All) shows all existing records associated with GCN>SMID/GCN>LCN and adds the ability to assign travel category and traveler type. This component is a staging area to assist in existing data that has not been associated. 
  - [X] Form Of Payment [jsx](form_of_payment.jsx)
    - [X] Add
    - [X] Edit
    - [ ] ref_travel_categories
    - [X] traveler_types

> [!WARNING]
> Category is not loading, needs debug in config
    
***Related Tables***
> form_of_payment,ref_travel_categories,traveler_types,smid,lcn

#### Air
##### <mark>Policy (Custom REACT component)</mark>
Policy is a custom react component stored in a module with dynamic data input that can be dynamically altered based on travel type, SMID/LCN. Policy is structured with Parent and child topic to assist in a structured topic tree. This module uses a JS action to compile the actions based on the data variables applied. 
  - [X] Policy Module [jsx](policy.jsx)
    - [X] Add Parent
    - [X] Edit Parent
    - [X] Add Child
    - [X] Edit Child
    - [X] traveler_types
    
***Related Tables***
> airpolicy,airpolicy_subtopcs,traveler_types,smid,lcn

##### <mark>Form of Payment (Custom REACT component)</mark>
FOP is a custom react component stored in a module with dynamic data input that can be dynamically altered based on travel type, SMID/LCN
  - [X] Form Of Payment [jsx](form_of_payment.jsx)
    - [X] Add
    - [X] Edit
    - [ ] ref_travel_categories
    - [X] traveler_types

> [!WARNING]
> Category is not loading, needs debug in config
    
***Related Tables***
> form_of_payment,ref_travel_categories,traveler_types,smid,lcn

##### <mark>Process (Custom REACT component)</mark>
Process is a simplified repo of account related processes. This table functions as a bridge of existing SP artifacts and future dev to a more robust relational data structure. Current iteration resolves to technology (tool) or OBT, travel category(multi select) and traveler type. 
  - [X] Process [jsx](process.jsx)
    - [X] Add
    - [X] Edit
    - [X] ref_travel_categories
    - [X] traveler_types
    - [X] technology
    - [X] obt

> [!WARNING]
> GCN / SMID text fields needs to be removed from form
    
***Related Tables***
> process,ref_technology,obt,ref_travel_categories,traveler_types,smid,lcn

##### <mark>Suppliers (Custom REACT component)</mark>
Supplier provides the preferred suppliers and associated contacts and any relevant information. Suppliers is a custom component nested in a module that uses dynamic data binding. 
  - [X] Suppliers [jsx](suppliers.jsx)
    - [X] Add
    - [X] Edit
    - [X] ref_travel_categories (inherited)
    - [X] Suppliers
    - [X] Supplier Contacts
    
***Related Tables***
> account_supplier_contacts,account_suppliers,supplier,ref_travel_categories,smid,lcn

##### <mark>Air Savings/Reason Codes (Custom REACT component)</mark>
TBD

##### <mark>Documents (Custom REACT component)</mark>
Component uses a sql query to filter docuements associated with travel category, SMID/LCN
  - [X] Documents [jsx](documents.jsx)
    - [X] View Only (PDF converted)
    
***Related Tables***
> documents

##### <mark>NDC</mark>
Static link to existing SP pages

> [!WARNING]
> This section will need to be developed in greater detail when schema of information can be reviewed. 

##### <mark>Traveler Types (Nested Custom REACT component)</mark>
Traveler types is a refinement on policy allowing for a more granular view of information as it pertains to the traveler type. Information related to Policy, Form of Payment, and Processes. Traveler selection is generated from a list of traveler types that are based on account level (GCN) attributes. JS actions trigger updates to queries to populate data in scope with traveler type. All Modules are inherited with data binding alteration per section with exception for fare class rules which is a more complex rule engine. 
  - [X] Fare Class Rules [jsx](fare_class_rules.jsx)
    - [X] Add
    - [X] Edit
  - [X] Policy [jsx](policy.jsx)
    - [X] Add
    - [X] Edit
  - [X] Form of Payment [jsx](form_of_payment.jsx)
    - [X] Add
    - [X] Edit
  - [X] Process [jsx](process.jsx)
    - [X] Add
    - [X] Edit
  
***Related Tables***
>fare_class_rules,fare_class_rules_logic,condition_criteria,traveler_types,smid,lcn - All other references are source in previous annotation

#### Car
##### <mark>Policy (Custom REACT component)</mark>
Policy is a custom react component stored in a module with dynamic data input that can be dynamically altered based on travel type, SMID/LCN. Policy is structured with Parent and child topic to assist in a structured topic tree. This module uses a JS action to compile the actions based on the data variables applied. 
  - [X] Policy Module [jsx](policy.jsx)
    - [X] Add Parent
    - [X] Edit Parent
    - [X] Add Child
    - [X] Edit Child
    - [X] traveler_types
    
***Related Tables***
> carpolicy,carpolicy_subtopcs,traveler_types,smid,lcn

##### <mark>Form of Payment (Custom REACT component)</mark>
FOP is a custom react component stored in a module with dynamic data input that can be dynamically altered based on travel type, SMID/LCN
  - [X] Form Of Payment [jsx](form_of_payment.jsx)
    - [X] Add
    - [X] Edit
    - [ ] ref_travel_categories
    - [X] traveler_types

> [!WARNING]
> Category is not loading, needs debug in config
    
***Related Tables***
> form_of_payment,ref_travel_categories,traveler_types,smid,lcn

##### <mark>Process (Custom REACT component)</mark>
Process is a simplified repo of account related processes. This table functions as a bridge of existing SP artifacts and future dev to a more robust relational data structure. Current iteration resolves to technology (tool) or OBT, travel category(multi select) and traveler type. 
  - [X] Process [jsx](process.jsx)
    - [X] Add
    - [X] Edit
    - [X] ref_travel_categories
    - [X] traveler_types
    - [X] technology
    - [X] obt

> [!WARNING]
> GCN / SMID text fields needs to be removed from form
    
***Related Tables***
> process,ref_technology,obt,ref_travel_categories,traveler_types,smid,lcn

##### <mark>Suppliers (Custom REACT component)</mark>
Supplier provides the preferred suppliers and associated contacts and any relevant information. Suppliers is a custom component nested in a module that uses dynamic data binding. 
  - [X] Suppliers [jsx](suppliers.jsx)
    - [X] Add
    - [X] Edit
    - [X] ref_travel_categories (inherited)
    - [X] Suppliers
    - [X] Supplier Contacts
    
***Related Tables***
> account_supplier_contacts,account_suppliers,supplier,ref_travel_categories,smid,lcn

##### <mark>Car Savings/Reason Codes (Custom REACT component)</mark>
TBD

##### <mark>Documents (Custom REACT component)</mark>
Component uses a sql query to filter docuements associated with travel category, SMID/LCN
  - [X] Documents [jsx](documents.jsx)
    - [X] View Only (PDF converted)
    
***Related Tables***
> documents

##### <mark>NDC</mark>
Static link to existing SP pages

> [!WARNING]
> This section will need to be developed in greater detail when schema of information can be reviewed. 

##### <mark>Traveler Types (Nested Custom REACT component)</mark>
Traveler types is a refinement on policy allowing for a more granular view of information as it pertains to the traveler type. Information related to Policy, Form of Payment, and Processes. Traveler selection is generated from a list of traveler types that are based on account level (GCN) attributes. JS actions trigger updates to queries to populate data in scope with traveler type. All Modules are inherited with data binding alteration per section with exception for fare class rules which is a more complex rule engine. 
  - [ ] Booking Rules 
    - [ ] Add
    - [ ] Edit
  - [X] Policy [jsx](general_topics.jsx)
    - [X] Add
    - [X] Edit
  - [X] Form of Payment [jsx](form_of_payment.jsx)
    - [X] Add
    - [X] Edit
  - [X] Process [jsx](process.jsx)
    - [X] Add
    - [X] Edit
  
***Related Tables***
>fare_class_rules,fare_class_rules_logic,condition_criteria,traveler_types,smid,lcn - All other references are source in previous annotation



## Phase 2 - Process and Procudures
TBD
## Phase 3 - News/Communication
TBD
## Phase 4 - Suppliers
TBD
## Phase 5 - Industry Specific
TBD
