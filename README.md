# Synchronize language

[![Build status](https://travis-ci.org/rocachien/sync-language.svg?branch=master)](http://travis-ci.org/rocachien/sync-language)



## Description

This is the library to synchronize language with local and server store language resource. 
the fast way for the developer add or change in the local file and sync to server database.

### Configuration object

Setting up the MS SQl connection for the:

    | User to connection:     | user     |
    | Password to connection: | password |
    | Server to connection:   | server   |
    | Database to connection: | database |

Setting up the SQL template:

    | SQL to load all languages:         | syncSQL           |
    | SQL template to ADD new language:  | sqlAddTemplate    |
    | SQL template to EDIT new language: | sqlUpdateTemplate |

Setting up the filter:

    | The prefix for resource id of languages: | prefix    |
    | The module for resource id of language:  | module    |

Setting the file local to store language:

    | File store data to compair version:         | fileDB           |
    | File localize to serve language for app:    | fileLG           |


## Changelog

### Version 0.0.1

* Initial release
