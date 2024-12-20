# Overview
The Canto Media Connector can be used to pull image assets from an existing Canto environment into a GraFx Studio template.

# Using the Canto Media Connector
The Canto Media Connector has two modes of browsing images, folder view and filter view.

## Folder view
This can be toggled on and off with the "Folder View" boolean value in the Connector options:  
![image](https://github.com/user-attachments/assets/e9d2d2f1-9990-421f-9e76-ae1287a0a213)  

When enabled, you can browse through folders and albums within the Canto environment to find the media asset you want.  


## Filter view
When the "Folder View" boolean value is toggled to false, the Connector will be in filter view mode. While here, there are a number of ways you can filter assets.

The "Keyword filter" configuration option:  
![image](https://github.com/user-attachments/assets/c50894d8-b478-4f03-ac31-aeed517f0fcf)  
Will perform a keyword search across the Canto environment. This acts as a general search, similar to the search functionality within Canto itself.  

The "Tag filter" configuration option:  
![image](https://github.com/user-attachments/assets/d8a0f4e8-248b-4a6c-bc19-e6206001f0a9)  
Will filter assets based on the supplied tag value.  

Both of the above configuration options allow for any values that Canto's API allows, for example a Keyword search of "Beach|Office" would return anything with a keyword of "Beach" or "Office".  

The "Album filter" option:  
![image](https://github.com/user-attachments/assets/5c57a5b5-6da5-4f73-b291-10df16141df9)  
Will filter based on specific Albums within the Canto environment. This takes Canto Album IDs, _not_ album names (i.e. IUO3O, T36LE, or N3GIN).  
You can also add multiple Album IDs to this field, separated by a `&` character, to search in multiple albums at the same time, for example:  
![image](https://github.com/user-attachments/assets/b543572b-8c38-48bb-9ab9-63365533666a)  

The "Only show approved" option:  
![image](https://github.com/user-attachments/assets/13ef1f07-98f9-4744-860a-1af6ed939eaf)  
Is a boolean field that allows you to hide any assets that aren't marked as `approved` within Canto.  

The "Fail Loading and Output if not approved" configuration option:  
![image](https://github.com/user-attachments/assets/4f528d9f-ac6f-4a34-bf42-26b29c0673b5)  
Will add an extra check to disallow images loading, and make GraFx Studio outputs fail, if they aren't marked as `approved` within Canto.  

All of the above configuration options can be used at the same time.  

## Metadata Mapping
The Canto Media Connector supports metadata mapping to GraFx Studio template variables. This includes default Canto asset metadata, and any metadata added in the "Custom Fields" section, for example:  
<img width="426" alt="image" src="https://github.com/user-attachments/assets/5ca3df10-5490-4b64-a127-77e4f1f04568" />  

![image](https://github.com/user-attachments/assets/b8e6e3ef-a4c2-4297-8233-7af836144be7)  
