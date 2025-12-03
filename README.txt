(CCAPDEV-MCO-FINAL)
MEMBERS:
Angeles, Marc Andrei D.(S11)
Dimacuangan, Aldwin Renzel P. (S11)
Ramos, Rafael Anton T. (S12)
Reyes, Ma. Julianna Re-an Dg. (S11)

INSTALL COMMANDS:
npm init
npm i express express-handlebars body-parser mongoose bcrypt

DATABASE SETUP
create a database named "EspressoSelf" (without "")
the program will make the schemas automatically
import data from the appropriate .json files found in the "databases" folder

(STDISCM-PSET-4)
MEMBERS:
De Guzman, Evan Mari B.
Dimaculangan, Aldwin Renzel P.
Kimhoko, Jamuel Erwin C.
Ramos, Rafael Anton T.

REQUISITES:
1. npm 
2. Docker Compose

BUILD COMMANDS:
1. Open the *CCAPDEV-MCO-FINAL* folder in terminal
2. In the terminal, run `docker-compose up -d`
You will see something like this:
[+] Running 4/4
 ✔ Container ccapdev-mco-final-core_api-1         Started                                                                                                                                                 1.6s
 ✔ Container ccapdev-mco-final-review_api-1       Started                                                                                                                                                 1.6s
 ✔ Container ccapdev-mco-final-reservation_api-1  Started                                                                                                                                                 1.4s
 ✔ Container ccapdev-mco-final-view_node-1        Started                                                                                                                                                 0.6s
The containers are the specific nodes we can use.
3. To simulate failure, run the command `docker stop container`

For example, to simulate failure on the core api,
docker stop docker stop ccapdev-mco-final-core_api-1

To start it again, run `docker start container`
